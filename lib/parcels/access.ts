// Server-only. Resolves what a Clerk user may read. Every query-layer function calls this first;
// callers (REST routes, the AI tool loop) never pass a county list they trust.
import { clerkClient } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { isClerkAdmin } from '@/lib/admin';
import { canonCounty } from '@/lib/counties';
import { getEntitlements, type Tier } from '@/lib/entitlements';

export class AccessError extends Error {
  status = 403;
  constructor(message: string) { super(message); this.name = 'AccessError'; }
}
export class NotFoundError extends Error {
  status = 404;
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}
export class InputError extends Error {
  status = 400;
  constructor(message: string) { super(message); this.name = 'InputError'; }
}

export interface Access {
  userId: string;
  isAdmin: boolean;
  tier: Tier;
  /** Canonical (lowercase) county names, or 'all'. */
  counties: Set<string> | 'all';
  /** Display names the user may query ('all' for everyone-with-all). */
  countyList: string[] | 'all';
}

const adminCache = new Map<string, { v: boolean; t: number }>();
async function clerkSaysAdmin(userId: string): Promise<boolean> {
  const hit = adminCache.get(userId);
  if (hit && Date.now() - hit.t < 5 * 60_000) return hit.v;
  let v = false;
  try {
    const client = await clerkClient();
    v = isClerkAdmin(await client.users.getUser(userId));
  } catch { /* Clerk unavailable: fall back to DB role only */ }
  adminCache.set(userId, { v, t: Date.now() });
  return v;
}

export async function resolveAccess(userId: string): Promise<Access> {
  if (!userId) throw new AccessError('Not signed in');
  const c = await pool.connect();
  let role = 'user';
  try {
    const r = await c.query('SELECT role FROM users WHERE clerk_id = $1', [userId]);
    role = r.rows[0]?.role ?? 'user';
  } finally { c.release(); }
  const isAdmin = role === 'admin' || (await clerkSaysAdmin(userId));
  if (isAdmin) return { userId, isAdmin, tier: 'enterprise', counties: 'all', countyList: 'all' };
  let ent;
  try { ent = await getEntitlements(userId); } catch { throw new AccessError('Account not found'); }
  if (ent.counties === 'all') return { userId, isAdmin, tier: ent.tier, counties: 'all', countyList: 'all' };
  return { userId, isAdmin, tier: ent.tier, counties: new Set(ent.counties.map(canonCounty)), countyList: ent.counties };
}

export function canReadCounty(a: Access, county: string): boolean {
  return a.counties === 'all' || a.counties.has(canonCounty(county));
}

export function assertCounty(a: Access, county: string): void {
  if (!canReadCounty(a, county)) throw new AccessError(`Your plan does not include ${county} County.`);
}
