// Finishes a just-paid Checkout Session without waiting for Stripe's webhook, so a customer who pays is let into
// the dashboard right away instead of being shown the "Private Beta" gate while the webhook is still in flight.
//
// Same entitlement logic as the webhook (syncSubscription), run for the signed-in user's OWN session only.
// Safe to run twice (the webhook may land at the same time): syncSubscription sets the same values either way.
import type { Pool } from 'pg';
import type Stripe from 'stripe';
import { syncSubscription } from './billing';

export type FinalizeStatus =
  | 'synced'          // entitlements written (or user is an admin and already has access)
  | 'pending'         // payment not complete yet, or our user row / subscription is not ready: try again shortly
  | 'invalid'         // session does not belong to this user or is not a subscription checkout
  | 'error';

export interface FinalizeResult { status: FinalizeStatus; detail: string }

export interface StripeLookups {
  getSession(id: string): Promise<Stripe.Checkout.Session>;
  getSubscription(id: string): Promise<Stripe.Subscription>;
}

export async function finalizeCheckout(pool: Pool, stripe: StripeLookups, sessionId: string | null | undefined, clerkUserId: string): Promise<FinalizeResult> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { status: 'invalid', detail: 'no_session_id' };

  let session: Stripe.Checkout.Session;
  try { session = await stripe.getSession(sessionId); }
  catch { return { status: 'error', detail: 'stripe_session_lookup_failed' }; }

  // Only the account that started this checkout can finish it.
  const owner = session.client_reference_id || session.metadata?.userId;
  if (!owner || owner !== clerkUserId) return { status: 'invalid', detail: 'session_belongs_to_someone_else' };
  if (session.mode !== 'subscription' || !session.customer) return { status: 'invalid', detail: 'not_a_subscription_checkout' };
  if (session.status !== 'complete') return { status: 'pending', detail: `session_${session.status}` };
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return { status: 'pending', detail: `payment_${session.payment_status}` };
  if (!session.subscription) return { status: 'pending', detail: 'no_subscription_yet' };

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

  let sub: Stripe.Subscription;
  try { sub = await stripe.getSubscription(subId); }
  catch { return { status: 'error', detail: 'stripe_subscription_lookup_failed' }; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET stripe_customer_id = $1 WHERE clerk_id = $2 AND stripe_customer_id IS NULL', [customerId, clerkUserId]);
    const r = await syncSubscription(client, sub);
    await client.query('COMMIT');
    if (r.action === 'synced' || r.action === 'skipped_admin') return { status: 'synced', detail: r.action };
    if (r.action === 'no_user_for_customer') return { status: 'pending', detail: r.action };   // Clerk webhook has not created the row yet
    return { status: 'pending', detail: r.action };
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    return { status: 'error', detail: e?.message ?? 'db_error' };
  } finally {
    client.release();
  }
}
