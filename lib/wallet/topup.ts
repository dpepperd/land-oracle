// Wallet top-ups through Stripe Checkout (one-time payment, TEST mode only until WALLET_ALLOW_LIVE=true).
// The wallet is credited ONLY by the Stripe webhook, after Stripe says the payment is paid. The success page does not credit anything.
import type { PoolClient } from 'pg';
import type Stripe from 'stripe';
import { credit } from './ledger';
import { BILLING_ENTITY, MAX_TOPUP_CENTS, MIN_TOPUP_CENTS } from './money';

export const TOPUP_PACKS_CENTS = [2000, 5000, 10000, 25000];

export const topupAmountError = (cents: unknown): string | null =>
  !Number.isInteger(cents) ? 'Enter a whole dollar or cent amount.'
  : (cents as number) < MIN_TOPUP_CENTS ? `The minimum top-up is $${MIN_TOPUP_CENTS / 100}.`
  : (cents as number) > MAX_TOPUP_CENTS ? `The maximum top-up is $${MAX_TOPUP_CENTS / 100}.`
  : null;

/** Parameters for the Checkout Session. Pure, so it can be tested without Stripe. */
export function topupSessionParams(o: { amountCents: number; clerkId: string; origin: string; stripeCustomerId?: string | null; email?: string }): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: o.amountCents,
        product_data: { name: 'Land Oracle wallet credit', description: `Prepaid wallet balance, billed by ${BILLING_ENTITY}.` },
      },
    }],
    ...(o.stripeCustomerId ? { customer: o.stripeCustomerId } : o.email ? { customer_email: o.email } : {}),
    client_reference_id: o.clerkId,
    metadata: { kind: 'wallet_topup', userId: o.clerkId, amountCents: String(o.amountCents) },
    payment_intent_data: { description: `Land Oracle wallet top-up (${BILLING_ENTITY})`, metadata: { kind: 'wallet_topup', userId: o.clerkId } },
    custom_text: { submit: { message: `Billed by ${BILLING_ENTITY}. Wallet balance is prepaid and used for postcards and lookups.` } },
    success_url: `${o.origin}/wallet?topup=success`,
    cancel_url: `${o.origin}/wallet?topup=cancelled`,
  };
}

export const isWalletTopup = (s: Stripe.Checkout.Session) => s.mode === 'payment' && s.metadata?.kind === 'wallet_topup';

/** Called inside the webhook's transaction. Credits the wallet once per Checkout Session (idempotent). */
export async function creditTopupFromSession(c: PoolClient, s: Stripe.Checkout.Session, livemode: boolean): Promise<{ credited: boolean; reason?: string; cents?: number }> {
  if (livemode && process.env.WALLET_ALLOW_LIVE !== 'true') return { credited: false, reason: 'live payments are not accepted for the wallet yet' };
  if (s.payment_status !== 'paid') return { credited: false, reason: 'not paid' };
  const cents = s.amount_total;
  if (s.currency !== 'usd' || !Number.isInteger(cents) || String(cents) !== s.metadata?.amountCents) return { credited: false, reason: 'amount mismatch' };
  if (topupAmountError(cents)) return { credited: false, reason: 'amount out of range' };
  const clerkId = s.client_reference_id || s.metadata?.userId;
  const u = clerkId ? (await c.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0] : null;
  if (!u) return { credited: false, reason: 'unknown account' };
  const res = await credit(c, { userId: u.id, cents: cents as number, kind: 'topup', ref: s.id, idempotencyKey: `stripe:${s.id}`, description: 'Wallet top-up' });
  return res.ok ? { credited: !res.duplicate, cents: cents as number, ...(res.duplicate ? { reason: 'already credited' } : {}) } : { credited: false, reason: 'ledger refused' };
}
