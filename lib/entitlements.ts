import pool from './db';
import { PLANS, FLORIDA_COUNTY_COUNT } from './plans';

export type Tier = 'free' | 'scout' | 'pro' | 'statewide' | 'enterprise';

export interface EntitlementStatus {
  tier: Tier;
  isAdmin: boolean;
  trialActive: boolean;
  daysRemaining?: number;
  /** Selected counties (display names), or 'all' (statewide / enterprise / admin). */
  counties: string[] | 'all';
  /** How many counties the user may select (base + add-ons). */
  allowance: number;
  /** Set on downgrade: the user must re-pick their counties. */
  needsCountyRepick: boolean;
  exports: { used: number; limit: number | 'unlimited' };
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
}

export const FREE_EXPORTS_PER_MONTH = 0; // free accounts cannot export CSV
export const FREE_COUNTY_ALLOWANCE = 1;

export const exportLimitFor = (tier: Tier): number | 'unlimited' =>
  tier === 'free' ? FREE_EXPORTS_PER_MONTH : tier === 'enterprise' ? 'unlimited' : PLANS[tier].exportsPerMonth;

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); };

/** Legacy tier names (demo, trial, local, regional, ...) are treated as free: nothing is auto-migrated. */
function normalizeTier(raw: string | null, isAdmin: boolean): Tier {
  if (isAdmin) return 'enterprise';
  return raw === 'scout' || raw === 'pro' || raw === 'statewide' || raw === 'enterprise' ? raw : 'free';
}

export async function getEntitlements(clerkId: string): Promise<EntitlementStatus> {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      `SELECT id, role, subscription_tier, subscription_status, trial_ends_at, county_allowance, needs_county_repick, cancel_at_period_end
         FROM users WHERE clerk_id = $1`, [clerkId]);
    if (userRes.rowCount === 0) throw new Error('User not found');
    const user = userRes.rows[0];
    const isAdmin = user.role === 'admin';
    const tier = normalizeTier(user.subscription_tier, isAdmin);

    let trialActive = false, daysRemaining = 0;
    if (tier === 'free' && user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
      trialActive = true;
      daysRemaining = Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    }

    const allowance = tier === 'statewide' || tier === 'enterprise' ? FLORIDA_COUNTY_COUNT
      : tier === 'free' ? FREE_COUNTY_ALLOWANCE : Math.max(Number(user.county_allowance) || 0, PLANS[tier].counties as number);

    let counties: string[] | 'all' = 'all';
    if (tier !== 'statewide' && tier !== 'enterprise') {
      // Only the first `allowance` selections count, even if extra rows exist (defense in depth).
      const r = await client.query('SELECT county FROM user_county_access WHERE user_id = $1 ORDER BY created_at NULLS FIRST, id LIMIT $2', [user.id, allowance]);
      counties = r.rows.map((x) => x.county);
    }

    const used = (await client.query('SELECT rows FROM export_usage WHERE user_id = $1 AND month = $2', [user.id, monthStart()])).rows[0]?.rows ?? 0;

    return {
      tier, isAdmin, trialActive, daysRemaining: trialActive ? daysRemaining : undefined, counties, allowance,
      needsCountyRepick: !!user.needs_county_repick,
      exports: { used: Number(used), limit: exportLimitFor(tier) },
      subscriptionStatus: user.subscription_status ?? null,
      cancelAtPeriodEnd: !!user.cancel_at_period_end,
    };
  } finally {
    client.release();
  }
}

/** Exact (case-insensitive, "St."="Saint") county access check. */
export async function hasCountyAccess(clerkId: string, county: string): Promise<boolean> {
  const { canonCounty } = await import('./counties');
  const e = await getEntitlements(clerkId);
  return e.counties === 'all' || e.counties.some((c) => canonCounty(c) === canonCounty(county));
}

/** Add one county to the user's selection if their allowance has room. */
export async function claimCounty(clerkId: string, county: string): Promise<{ ok: boolean; reason?: 'full' | 'no_user' }> {
  const e = await getEntitlements(clerkId);
  if (e.counties === 'all') return { ok: true };
  if (e.counties.length >= e.allowance) return { ok: false, reason: 'full' };
  const client = await pool.connect();
  try {
    const u = await client.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId]);
    if (!u.rows[0]) return { ok: false, reason: 'no_user' };
    await client.query('INSERT INTO user_county_access (user_id, county) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM user_county_access WHERE user_id = $1 AND county = $2)', [u.rows[0].id, county]);
    await client.query('UPDATE users SET needs_county_repick = false WHERE id = $1 AND (SELECT count(*) FROM user_county_access WHERE user_id = $1) >= $2', [u.rows[0].id, e.allowance]);
    return { ok: true };
  } finally {
    client.release();
  }
}

/**
 * Replace the whole selection (used by the re-pick flow after a downgrade). Rejects more than the allowance.
 */
export async function setCounties(clerkId: string, counties: string[]): Promise<{ ok: boolean; error?: string }> {
  const e = await getEntitlements(clerkId);
  if (e.counties === 'all') return { ok: true };
  const unique = [...new Set(counties)];
  if (unique.length > e.allowance) return { ok: false, error: `Your plan includes ${e.allowance} ${e.allowance === 1 ? 'county' : 'counties'}.` };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = (await client.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0];
    if (!u) { await client.query('ROLLBACK'); return { ok: false, error: 'Account not found' }; }
    await client.query('DELETE FROM user_county_access WHERE user_id = $1', [u.id]);
    for (const c of unique) await client.query('INSERT INTO user_county_access (user_id, county) VALUES ($1, $2)', [u.id, c]);
    await client.query('UPDATE users SET needs_county_repick = false WHERE id = $1', [u.id]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Atomically record exported rows for this calendar month. Returns allowed=false (and records nothing) if it would exceed the cap.
 */
export async function trackExport(clerkId: string, count: number): Promise<{ allowed: boolean; remaining: number | 'unlimited'; used: number }> {
  const e = await getEntitlements(clerkId);
  const cap = e.exports.limit === 'unlimited' ? null : e.exports.limit;
  if (cap !== null && count > cap) return { allowed: false, remaining: Math.max(0, cap - e.exports.used), used: e.exports.used };
  const client = await pool.connect();
  try {
    const u = (await client.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0];
    const r = await client.query(
      `INSERT INTO export_usage (user_id, month, rows) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month) DO UPDATE SET rows = export_usage.rows + EXCLUDED.rows
         WHERE $4::int IS NULL OR export_usage.rows + EXCLUDED.rows <= $4::int
       RETURNING rows`, [u.id, monthStart(), count, cap]);
    if (r.rowCount === 0) return { allowed: false, remaining: 0, used: e.exports.used };
    const used = Number(r.rows[0].rows);
    return { allowed: true, remaining: cap === null ? 'unlimited' : cap - used, used };
  } finally {
    client.release();
  }
}
