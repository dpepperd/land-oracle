import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import pool from '@/lib/db';
import { markPaymentFailed, syncSubscription } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Events: checkout.session.completed, customer.subscription.created|updated|deleted, invoice.payment_failed.
// Entitlements are always derived from the Subscription object (lib/billing.ts). Idempotent via stripe_events.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new NextResponse('Webhook not configured', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error: any) {
    console.error(`[stripe-webhook] signature verification failed: ${error.message}`);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const client = await pool.connect();
  try {
    const seen = await client.query('INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id', [event.id, event.type]);
    if (seen.rowCount === 0) return NextResponse.json({ received: true, duplicate: true });

    let result: unknown = { ignored: event.type };
    try {
      await client.query('BEGIN');
      switch (event.type) {
        case 'checkout.session.completed': {
          const s = event.data.object as Stripe.Checkout.Session;
          if (s.mode !== 'subscription' || !s.subscription || !s.customer) break;
          const customerId = typeof s.customer === 'string' ? s.customer : s.customer.id;
          const clerkId = s.client_reference_id || s.metadata?.userId;
          if (clerkId) await client.query('UPDATE users SET stripe_customer_id = $1 WHERE clerk_id = $2 AND stripe_customer_id IS NULL', [customerId, clerkId]);
          const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
          result = await syncSubscription(client, sub);
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          result = await syncSubscription(client, event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          const cust = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
          if (cust) result = await markPaymentFailed(client, cust);
          break;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      await client.query('DELETE FROM stripe_events WHERE id = $1', [event.id]).catch(() => {});   // let Stripe retry
      throw e;
    }
    console.log(`[stripe-webhook] ${event.type}`, JSON.stringify(result));
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe-webhook] handler error:', err?.message);
    return new NextResponse('Handler error', { status: 500 });
  } finally {
    client.release();
  }
}
