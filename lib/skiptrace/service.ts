// Skip tracing service: flag, owner key, credits, shared cache, ledger. Vendor-neutral (the vendor is a SkipTraceProvider).
//
// Money rules (each one is tested in scripts/ai/test-skiptrace.ts):
//   - The vendor is called at most once per owner: results (hits AND misses) are cached for CACHE_DAYS and shared across accounts.
//   - An account is charged 1 credit only for a HIT, and only the first time that account sees that owner. Repeats, misses and vendor failures are free.
//   - No credit, no lookup: with 0 credits the vendor is never called.
//   - Two simultaneous requests for the same owner cannot both call the vendor or both charge (advisory lock per owner, row lock on credits).
//   - Admins get no free pass: every lookup costs real money.
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { getParcel, AccessError, NotFoundError, InputError } from '@/lib/parcels';
import { getProvider } from './providers';
import { ProviderError, SkipTraceError, type ContactResult, type LookupOutcome, type OwnerQuery, type SkipTraceProvider } from './types';

export const CACHE_DAYS = 180;
export const PROVIDER_TIMEOUT_MS = 15_000;

/** OFF unless SKIPTRACE_ENABLED=true. Checked on every request, so it can be switched off instantly. */
export const skipTraceEnabled = () => process.env.SKIPTRACE_ENABLED === 'true';

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Same owner, same key: case, punctuation and spacing do not matter. Hashed so the cache table holds no readable owner names. */
export function ownerKey(q: Pick<OwnerQuery, 'name' | 'mailingAddress'>): string {
  return createHash('sha256').update(`${normalize(q.name)}|${normalize(q.mailingAddress)}`).digest('hex');
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new ProviderError('The lookup service took too long.')), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export async function creditsFor(userDbId: number): Promise<number> {
  const r = await pool.query('SELECT balance FROM skip_trace_credits WHERE user_id = $1', [userDbId]);
  return r.rows[0]?.balance ?? 0;
}

/** Adds credits to an account (used by scripts and, later, the purchase flow). Returns the new balance. */
export async function grantCredits(userDbId: number, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive whole number');
  const r = await pool.query(
    `INSERT INTO skip_trace_credits (user_id, balance) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET balance = skip_trace_credits.balance + EXCLUDED.balance, updated_at = now()
     RETURNING balance`, [userDbId, amount]);
  return r.rows[0].balance;
}

async function rollbackQuiet(c: PoolClient) { try { await c.query('ROLLBACK'); } catch { /* connection already gone */ } }

/**
 * Looks up one owner for one account. `provider` is injectable for tests.
 * Never logs phone numbers or emails.
 */
export async function lookupContact(userDbId: number, q: OwnerQuery, opts: { parcelKey?: string | null; provider?: SkipTraceProvider } = {}): Promise<LookupOutcome> {
  if (!skipTraceEnabled()) throw new SkipTraceError('not_available', 'Owner contact lookup is not available.', 404);
  const key = ownerKey(q);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // One lookup per owner at a time (stops a double click paying twice), and one per account at a time on the credit row.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);

    const cachedRow = (await client.query(
      `SELECT provider, matched, phones, emails FROM skip_trace_cache WHERE owner_key = $1 AND fetched_at > now() - ($2 || ' days')::interval`, [key, String(CACHE_DAYS)])).rows[0];
    const alreadyPaid = (await client.query('SELECT 1 FROM skip_trace_lookups WHERE user_id = $1 AND owner_key = $2 AND charged > 0 LIMIT 1', [userDbId, key])).rowCount! > 0;

    await client.query('INSERT INTO skip_trace_credits (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userDbId]);
    const balance: number = (await client.query('SELECT balance FROM skip_trace_credits WHERE user_id = $1 FOR UPDATE', [userDbId])).rows[0].balance;

    let result: ContactResult;
    let cached = false;
    if (cachedRow) {
      result = { matched: cachedRow.matched, phones: cachedRow.phones, emails: cachedRow.emails, provider: cachedRow.provider };
      cached = true;
      // A saved hit this account has not paid for yet still costs one credit. No credit: nothing is shown.
      if (result.matched && !alreadyPaid && balance < 1) throw new SkipTraceError('no_credits', 'You are out of owner contact credits.', 402);
    } else {
      if (balance < 1) throw new SkipTraceError('no_credits', 'You are out of owner contact credits.', 402);
      const provider = opts.provider ?? getProvider();
      try { result = await withTimeout(provider.lookup(q), PROVIDER_TIMEOUT_MS); }
      catch (e) {
        console.error('[skiptrace] provider failed:', provider.id, (e as Error).message);
        throw new SkipTraceError('provider_failed', 'The lookup service is not responding right now. You were not charged. Please try again later.', 502);
      }
      await client.query(
        `INSERT INTO skip_trace_cache (owner_key, provider, matched, phones, emails, fetched_at) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb, now())
         ON CONFLICT (owner_key) DO UPDATE SET provider = EXCLUDED.provider, matched = EXCLUDED.matched, phones = EXCLUDED.phones, emails = EXCLUDED.emails, fetched_at = now()`,
        [key, result.provider, result.matched, JSON.stringify(result.phones), JSON.stringify(result.emails)]);
    }

    const charged = result.matched && !alreadyPaid ? 1 : 0;
    let creditsLeft = balance;
    if (charged) {
      creditsLeft = (await client.query('UPDATE skip_trace_credits SET balance = balance - 1, used = used + 1, updated_at = now() WHERE user_id = $1 RETURNING balance', [userDbId])).rows[0].balance;
    }
    await client.query(
      'INSERT INTO skip_trace_lookups (user_id, owner_key, parcel_key, provider, matched, cached, charged) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userDbId, key, opts.parcelKey ?? null, result.provider, result.matched, cached, charged]);
    await client.query('COMMIT');
    console.log(`[skiptrace] owner=${key.slice(0, 8)} matched=${result.matched} cached=${cached} charged=${charged} left=${creditsLeft}`);
    return { ...result, cached, charged, creditsLeft };
  } catch (e) {
    await rollbackQuiet(client);
    throw e;
  } finally {
    client.release();
  }
}

/** The route's entry point: checks the account may see this parcel (county plan enforced by getParcel), then looks up its owner. */
export async function lookupForParcel(clerkId: string, parcelKey: string, provider?: SkipTraceProvider): Promise<LookupOutcome> {
  if (!skipTraceEnabled()) throw new SkipTraceError('not_available', 'Owner contact lookup is not available.', 404);
  const u = (await pool.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0];
  if (!u) throw new SkipTraceError('forbidden', 'Account not found.', 403);
  let parcel;
  try { parcel = await getParcel(clerkId, parcelKey); }
  catch (e) {
    if (e instanceof AccessError) throw new SkipTraceError('forbidden', e.message, 403);
    if (e instanceof NotFoundError) throw new SkipTraceError('not_found', 'Parcel not found.', 404);
    if (e instanceof InputError) throw new SkipTraceError('bad_request', e.message, 400);
    throw e;
  }
  if (!parcel.owner_name || !parcel.mail_address) throw new SkipTraceError('no_owner', 'This parcel has no owner name or mailing address on the roll, so there is nothing to look up.', 422);
  return lookupContact(u.id, { name: parcel.owner_name, mailingAddress: parcel.mail_address, propertyAddress: parcel.situs_address }, { parcelKey, provider });
}
