// Skip tracing service: flag, owner key, wallet charging, shared cache, ledger. Vendor-neutral (the vendor is a SkipTraceProvider).
//
// Paid from the wallet (lib/wallet). Contact data is the item `skip_trace`; the Do Not Call (DNC) check is the add-on item `skip_trace_dnc`.
// Prices and on/off switches are admin settings (/admin/settings), and the DNC mode (off / optional / required) too. Nothing is priced in code.
//
// Money rules (each one is tested in scripts/ai/test-skiptrace.ts):
//   - The vendor is called at most once per owner: results (hits AND misses) are cached for CACHE_DAYS and shared across accounts.
//     The DNC status on saved phones is only trusted for DNC_FRESH_DAYS (it goes stale fast); a stale one is re-checked at the vendor.
//   - Before the vendor is called, the most this lookup can cost is HELD in the wallet (one hold per item). A hit settles the hold into a
//     charge, a miss or a vendor failure releases it. No funds, no lookup (the vendor is never called).
//   - An account pays for contact data only for a HIT, only the first time it sees that owner; the DNC check only when phones came back and
//     every phone has a yes/no answer, and again only after DNC_FRESH_DAYS. Repeats, misses and vendor failures cost nothing.
//   - Two simultaneous requests for the same owner cannot both call the vendor or both charge (advisory lock per owner, wallet row locks).
//   - DNC flags are only shown to an account that bought the check: a saved result never gives them away for free.
//   - Admins get no free pass: every lookup costs real money.
import { createHash, randomUUID } from 'crypto';
import pool from '@/lib/db';
import { getParcel, AccessError, NotFoundError, InputError } from '@/lib/parcels';
import { getProvider } from './providers';
import { ProviderError, SkipTraceError, type ContactPhone, type ContactResult, type LookupOutcome, type OwnerQuery, type SkipTraceProvider } from './types';
import { getPrices, getSkipTraceOptions, SettingsError, type DncMode } from '@/lib/wallet/settings';
import { releaseHold, reserveForService, settleHold } from '@/lib/wallet/charge';
import { getAvailable, inTx, keepHold } from '@/lib/wallet/ledger';

export const CACHE_DAYS = 180;
/** How long a Do Not Call status counts as current. (Callers generally must re-check about every 31 days: confirm with the lawyer.) */
export const DNC_FRESH_DAYS = 30;
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

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const NOT_AVAILABLE = 'Owner contact lookup is not available.';

/** What the account can buy right now: prices from settings, DNC mode, whether this vendor can do DNC. Throws SkipTraceError when nothing can be sold. */
async function offerFor(provider: SkipTraceProvider) {
  let prices, options;
  try { prices = await getPrices(pool); options = await getSkipTraceOptions(pool); }
  catch (e) { if (e instanceof SettingsError) throw new SkipTraceError('not_available', NOT_AVAILABLE, 503); throw e; }
  const c = prices.skip_trace, d = prices.skip_trace_dnc;
  if (!c.enabled || c.cents <= 0) throw new SkipTraceError('not_available', NOT_AVAILABLE, 404);
  const dncSellable = d.enabled && d.cents > 0 && provider.capabilities.dnc;
  const mode: DncMode = options.dnc;
  if (mode === 'required' && !dncSellable) throw new SkipTraceError('not_available', NOT_AVAILABLE, 404); // never sell contact data without the check when it is required
  return { contactCents: c.cents, dncCents: d.cents, dncSellable, mode };
}

/** For the screen: can this account buy owner contact, what does it cost, and how much can it spend. */
export async function skipTraceOffer(userDbId: number): Promise<
  | { available: false }
  | { available: true; balanceCents: number; contactCents: number; dnc: { mode: 'optional' | 'required'; cents: number } | null; totalCents: number }
> {
  try {
    const o = await offerFor(getProvider());
    const dnc = o.dncSellable && o.mode !== 'off' ? { mode: o.mode as 'optional' | 'required', cents: o.dncCents } : null;
    return { available: true, balanceCents: await getAvailable(pool, userDbId), contactCents: o.contactCents, dnc, totalCents: o.contactCents + (dnc?.mode === 'required' ? dnc.cents : 0) };
  } catch (e) {
    if (e instanceof SkipTraceError) return { available: false };
    return { available: false }; // no vendor configured, or a broken setting: not offered
  }
}

/**
 * Looks up one owner for one account. `provider` is injectable for tests. `dnc` asks for the Do Not Call check (only when the mode is "optional";
 * "required" always includes it, "off" never does). Never logs phone numbers or emails.
 */
export async function lookupContact(userDbId: number, q: OwnerQuery, opts: { parcelKey?: string | null; provider?: SkipTraceProvider; dnc?: boolean } = {}): Promise<LookupOutcome> {
  if (!skipTraceEnabled()) throw new SkipTraceError('not_available', NOT_AVAILABLE, 404);
  const provider = opts.provider ?? getProvider();
  const offer = await offerFor(provider);
  const wantDnc = offer.mode === 'required' ? true : offer.mode === 'optional' ? !!opts.dnc : false;
  if (wantDnc && !offer.dncSellable) throw new SkipTraceError('not_available', 'The Do Not Call check is not available right now.', 404);

  const key = ownerKey(q);
  const label = `owner ${key.slice(0, 8)}`;
  const attempt = randomUUID(); // one set of holds per request; a retry is a new request
  const holds: { contact?: number; dnc?: number } = {};
  const closed = new Set<number>();
  const client = await pool.connect();
  let locked = false;
  try {
    // One lookup per owner at a time (stops a double click paying twice or calling the vendor twice).
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [key]); locked = true;

    const cachedRow = (await client.query(
      `SELECT provider, matched, phones, emails, dnc_checked_at,
              (dnc_checked_at IS NOT NULL AND dnc_checked_at > now() - ($2 || ' days')::interval) AS dnc_fresh
         FROM skip_trace_cache WHERE owner_key = $1 AND fetched_at > now() - ($3 || ' days')::interval`, [key, String(DNC_FRESH_DAYS), String(CACHE_DAYS)])).rows[0];
    const paid = (await client.query(
      `SELECT COALESCE(bool_or(paid_contact_cents > 0), false) AS contact,
              COALESCE(bool_or(paid_dnc_cents > 0 AND created_at > now() - ($3 || ' days')::interval), false) AS dnc
         FROM skip_trace_lookups WHERE user_id = $1 AND owner_key = $2`, [userDbId, key, String(DNC_FRESH_DAYS)])).rows[0];

    const savedHasPhones = !!cachedRow && cachedRow.matched && cachedRow.phones.length > 0;
    const needVendor = !cachedRow || (wantDnc && savedHasPhones && !cachedRow.dnc_fresh);
    // The most this request can cost (a hit is not known until the vendor answers).
    const maxContact = !paid.contact && (!cachedRow || cachedRow.matched);
    const maxDnc = wantDnc && !paid.dnc && (!cachedRow || savedHasPhones);

    // ---- hold the money first: no funds, no vendor call
    const fail = (r: { reason: string }) => r.reason === 'insufficient'
      ? new SkipTraceError('insufficient_funds', `Not enough wallet balance for this lookup (${usd((maxContact ? offer.contactCents : 0) + (maxDnc ? offer.dncCents : 0))}). Add funds to your wallet first.`, 402)
      : new SkipTraceError('not_available', NOT_AVAILABLE, 404);
    if (maxContact) {
      const h = await reserveForService(pool, { userId: userDbId, item: 'skip_trace', idempotencyKey: `skiptrace:${attempt}:contact`, ref: label, description: 'Owner contact lookup' });
      if (!h.ok) throw fail(h);
      holds.contact = h.holdId;
    }
    if (maxDnc) {
      const h = await reserveForService(pool, { userId: userDbId, item: 'skip_trace_dnc', idempotencyKey: `skiptrace:${attempt}:dnc`, ref: label, description: 'Do Not Call check' });
      if (!h.ok) throw fail(h);
      holds.dnc = h.holdId;
    }

    // ---- the vendor (or the saved result)
    let result: ContactResult;
    let dncCheckedAt: Date | null = cachedRow?.dnc_checked_at ? new Date(cachedRow.dnc_checked_at) : null;
    if (needVendor) {
      try { result = await withTimeout(provider.lookup(q, { dnc: wantDnc }), PROVIDER_TIMEOUT_MS); }
      catch (e) {
        console.error('[skiptrace] provider failed:', provider.id, (e as Error).message);
        throw new SkipTraceError('provider_failed', 'The lookup service is not responding right now. You were not charged. Please try again later.', 502);
      }
      dncCheckedAt = wantDnc && result.matched ? new Date() : null;
      await client.query(
        `INSERT INTO skip_trace_cache (owner_key, provider, matched, phones, emails, fetched_at, dnc_checked_at) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb, now(), $6)
         ON CONFLICT (owner_key) DO UPDATE SET provider = EXCLUDED.provider, matched = EXCLUDED.matched, phones = EXCLUDED.phones, emails = EXCLUDED.emails, fetched_at = now(), dnc_checked_at = EXCLUDED.dnc_checked_at`,
        [key, result.provider, result.matched, JSON.stringify(result.phones), JSON.stringify(result.emails), dncCheckedAt]);
    } else {
      result = { matched: cachedRow.matched, phones: cachedRow.phones, emails: cachedRow.emails, provider: cachedRow.provider };
    }

    // ---- settle what was earned, release the rest
    // The DNC check counts only if every phone has a yes/no answer: "unknown" is not "safe", and we do not charge for an unanswered check.
    const dncAnswered = wantDnc && result.matched && result.phones.length > 0 && result.phones.every((p: ContactPhone) => typeof p.doNotCall === 'boolean');
    const contactDue = result.matched && !paid.contact && holds.contact !== undefined;
    const dncDue = dncAnswered && !paid.dnc && holds.dnc !== undefined;
    const close = async (item: 'contact' | 'dnc', due: boolean): Promise<number> => {
      const id = holds[item]; if (id === undefined) return 0;
      if (!due) { await releaseHold(pool, id, result.matched ? 'nothing_to_charge' : 'no_match'); closed.add(id); return 0; }
      let s = await settleHold(pool, id, { ref: label }).catch(() => null);
      if (!s || !s.ok) s = await settleHold(pool, id, { ref: label }).catch(() => null); // one retry
      closed.add(id);
      if (!s || !s.ok) { // delivered but not charged: keep the money held for a person (it never expires on its own)
        console.error('[skiptrace] settle failed, hold kept for review:', id);
        await inTx(pool, (c) => keepHold(c, id, 'lookup delivered, settle failed: needs attention')).catch(() => {});
        return 0;
      }
      return s.chargedCents;
    };
    const chargedContactCents = await close('contact', contactDue);
    const chargedDncCents = await close('dnc', dncDue);

    await client.query(
      `INSERT INTO skip_trace_lookups (user_id, owner_key, parcel_key, provider, matched, cached, charged, paid_contact_cents, paid_dnc_cents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userDbId, key, opts.parcelKey ?? null, result.provider, result.matched, !needVendor, chargedContactCents > 0 ? 1 : 0, chargedContactCents, chargedDncCents]);

    const dncIncluded = dncAnswered && (paid.dnc || chargedDncCents > 0);
    const phones: ContactPhone[] = dncIncluded ? result.phones : result.phones.map(({ number, type }) => ({ number, type })); // DNC flags are not given away with a saved result
    const balanceCents = await getAvailable(pool, userDbId);
    console.log(`[skiptrace] ${label} matched=${result.matched} cached=${!needVendor} dnc=${dncIncluded} charged=${chargedContactCents + chargedDncCents} left=${balanceCents}`);
    return {
      ...result, phones, cached: !needVendor,
      chargedCents: chargedContactCents + chargedDncCents, chargedContactCents, chargedDncCents, balanceCents,
      dncIncluded, dncCheckedAt: dncIncluded && dncCheckedAt ? dncCheckedAt.toISOString() : null,
    };
  } catch (e) {
    for (const id of [holds.contact, holds.dnc]) if (id !== undefined && !closed.has(id)) await releaseHold(pool, id, 'error').catch(() => {});
    throw e;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => {});
    client.release();
  }
}

/** The route's entry point: checks the account may see this parcel (county plan enforced by getParcel), then looks up its owner. */
export async function lookupForParcel(clerkId: string, parcelKey: string, opts: { dnc?: boolean; provider?: SkipTraceProvider } = {}): Promise<LookupOutcome> {
  if (!skipTraceEnabled()) throw new SkipTraceError('not_available', NOT_AVAILABLE, 404);
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
  return lookupContact(u.id, { name: parcel.owner_name, mailingAddress: parcel.mail_address, propertyAddress: parcel.situs_address }, { parcelKey, provider: opts.provider, dnc: opts.dnc });
}
