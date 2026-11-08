// Subscription -> entitlement sync. Pure DB logic over a Stripe Subscription object so it is testable without Stripe.
// Plan and add-on quantity are derived from the subscription's price lookup_keys (scout_monthly, addon_county_annual, ...),
// not from metadata, so plan changes made in the Customer Portal or via the API are handled identically.
import type { PoolClient } from 'pg';
import type Stripe from 'stripe';
import { countyAllowance, isPlanId, type PlanId } from './plans';

export const FREE_COUNTY_ALLOWANCE = 1;
const ENTITLED = new Set(['active', 'trialing', 'past_due']);   // past_due keeps access while Stripe retries the card
const REVOKED = new Set(['canceled', 'unpaid', 'incomplete_expired']);

export interface Parsed { plan: PlanId | null; interval: 'month' | 'year' | null; addonQty: number }

export function parseSubscription(sub: Stripe.Subscription): Parsed {
  let plan: PlanId | null = null, interval: 'month' | 'year' | null = null, addonQty = 0;
  for (const item of sub.items?.data ?? []) {
    const key = item.price?.lookup_key ?? '';
    const m = /^(scout|pro|statewide|addon_county)_(monthly|annual)$/.exec(key);
    if (!m) continue;
    if (m[1] === 'addon_county') addonQty += item.quantity ?? 1;
    else if (isPlanId(m[1])) { plan = m[1]; interval = m[2] === 'monthly' ? 'month' : 'year'; }
  }
  return { plan, interval, addonQty };
}

export interface SyncResult { userId: number | null; action: string; tier?: string; allowance?: number; trimmed?: number; needsRepick?: boolean }

async function findUser(c: PoolClient, customerId: string, clerkId?: string | null) {
  let r = await c.query('SELECT id, role FROM users WHERE stripe_customer_id = $1', [customerId]);
  if (r.rows[0]) return r.rows[0];
  if (clerkId) {
    r = await c.query('SELECT id, role FROM users WHERE clerk_id = $1', [clerkId]);
    if (r.rows[0]) { await c.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, r.rows[0].id]); return r.rows[0]; }
  }
  return null;
}

/** Keep the first `allowance` selected counties (by selection order); report how many were removed. */
async function enforceCountyAllowance(c: PoolClient, userId: number, allowance: number): Promise<number> {
  const rows = (await c.query('SELECT id FROM user_county_access WHERE user_id = $1 ORDER BY created_at NULLS FIRST, id', [userId])).rows;
  if (rows.length <= allowance) return 0;
  const drop = rows.slice(allowance).map((r) => r.id);
  await c.query('DELETE FROM user_county_access WHERE id = ANY($1)', [drop]);
  return drop.length;
}

export async function syncSubscription(c: PoolClient, sub: Stripe.Subscription): Promise<SyncResult> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const user = await findUser(c, customerId, sub.metadata?.userId);
  if (!user) return { userId: null, action: 'no_user_for_customer' };
  if (user.role === 'admin') return { userId: user.id, action: 'skipped_admin' };   // admins keep enterprise access

  const parsed = parseSubscription(sub);
  const periodEnd = (sub.items?.data?.[0] as any)?.current_period_end ?? (sub as any).current_period_end ?? null;
  const periodEndTs = periodEnd ? new Date(periodEnd * 1000) : null;

  if (REVOKED.has(sub.status)) {
    // Only revoke if this is the subscription we currently honour (a stale cancel must not kill a newer subscription).
    const cur = await c.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [user.id]);
    if (cur.rows[0].stripe_subscription_id && cur.rows[0].stripe_subscription_id !== sub.id) return { userId: user.id, action: 'ignored_stale_cancel' };
    const trimmed = await enforceCountyAllowance(c, user.id, FREE_COUNTY_ALLOWANCE);
    await c.query(
      `UPDATE users SET subscription_tier = 'free', subscription_status = $2, stripe_subscription_id = NULL, plan_interval = NULL,
              county_allowance = $3, cancel_at_period_end = false, current_period_end = NULL, needs_county_repick = $4 WHERE id = $1`,
      [user.id, sub.status, FREE_COUNTY_ALLOWANCE, trimmed > 0]);
    return { userId: user.id, action: 'revoked', tier: 'free', allowance: FREE_COUNTY_ALLOWANCE, trimmed, needsRepick: trimmed > 0 };
  }
  if (!ENTITLED.has(sub.status)) return { userId: user.id, action: `ignored_status_${sub.status}` };   // incomplete etc.: wait
  if (!parsed.plan) return { userId: user.id, action: 'unrecognised_price_no_change' };               // legacy price: never auto-migrate

  const allowance = countyAllowance(parsed.plan, parsed.addonQty);
  const trimmed = parsed.plan === 'statewide' ? 0 : await enforceCountyAllowance(c, user.id, allowance);
  await c.query(
    `UPDATE users SET subscription_tier = $2, subscription_status = $3, stripe_subscription_id = $4, plan_interval = $5,
            county_allowance = $6, cancel_at_period_end = $7, current_period_end = $8, beta_access = true,
            needs_county_repick = CASE WHEN $9 > 0 THEN true WHEN $6 > county_allowance THEN false ELSE needs_county_repick END WHERE id = $1`,
    [user.id, parsed.plan, sub.status, sub.id, parsed.interval, allowance, !!sub.cancel_at_period_end, periodEndTs, trimmed]);
  return { userId: user.id, action: 'synced', tier: parsed.plan, allowance, trimmed, needsRepick: trimmed > 0 };
}

export async function markPaymentFailed(c: PoolClient, customerId: string): Promise<SyncResult> {
  const user = await findUser(c, customerId);
  if (!user) return { userId: null, action: 'no_user_for_customer' };
  if (user.role === 'admin') return { userId: user.id, action: 'skipped_admin' };
  await c.query(`UPDATE users SET subscription_status = 'past_due' WHERE id = $1 AND stripe_subscription_id IS NOT NULL`, [user.id]);
  return { userId: user.id, action: 'past_due' };
}
