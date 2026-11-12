import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import pool from '@/lib/db';
import { PLANS, lookupKey, maxAddonCounties } from '@/lib/plans';

export const runtime = 'nodejs';

const bodySchema = z.object({
  plan: z.enum(['scout', 'pro', 'statewide']),
  interval: z.enum(['month', 'year']),
  addonCounties: z.number().int().min(0).max(66).default(0),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();
  if (!userId || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { plan, interval } = body;
  const addon = PLANS[plan].addonAllowed ? Math.min(body.addonCounties, maxAddonCounties(plan)) : 0;     // add-ons: scout and pro only, never more than Florida has

  // Resolve prices by lookup_key (never hardcoded price ids).
  const keys = [lookupKey(plan, interval), ...(addon > 0 ? [lookupKey('addon_county', interval)] : [])];
  const prices = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  const byKey = new Map(prices.data.map((p) => [p.lookup_key, p]));
  if (keys.some((k) => !byKey.has(k))) {
    console.error('[checkout] missing Stripe prices for lookup_keys', keys.filter((k) => !byKey.has(k)));
    return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 });
  }

  const db = await pool.connect();
  try {
    const row = (await db.query('SELECT id, stripe_customer_id, stripe_subscription_id, subscription_status FROM users WHERE clerk_id = $1', [userId])).rows[0];
    if (!row) return NextResponse.json({ error: 'Account is still being set up. Please retry in a moment.' }, { status: 409 });
    if (row.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(row.subscription_status)) {
      // Plan changes go through /api/billing/change-plan (or the portal); never create a second subscription.
      return NextResponse.json({ error: 'You already have a subscription. Use Manage Billing to change plans.', code: 'already_subscribed' }, { status: 409 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        { price: byKey.get(keys[0])!.id, quantity: 1 },
        ...(addon > 0 ? [{ price: byKey.get(keys[1])!.id, quantity: addon }] : []),
      ],
      allow_promotion_codes: true,
      ...(row.stripe_customer_id ? { customer: row.stripe_customer_id } : { customer_email: email }),
      client_reference_id: userId,
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId, plan, interval, addonCounties: String(addon) },
      subscription_data: { metadata: { userId, plan, interval, addonCounties: String(addon) } },
    });
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[checkout] error', error?.message);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  } finally {
    db.release();
  }
}
