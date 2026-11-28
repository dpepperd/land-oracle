// The one door every paid service uses to charge the wallet (postcards now; skip trace, property data, permits and monitor alerts later).
//   - the price comes from admin settings (app_settings), never from the caller's code;
//   - an item that is switched off, or has no price, cannot be charged;
//   - the money moves through the ledger, so a balance can never go negative and an idempotency key charges once.
// A service that already showed the user a price may pass quotedCents so the user pays what they were shown.
//
// Two ways to charge:
//   chargeForService()   charge now (the service has already succeeded, or costs us nothing to undo).
//   reserveForService()  a service that SPENDS OUR MONEY before it knows the outcome (a vendor lookup, a Lob card): set the money aside first,
//                        then settleHold() on success (the money becomes a charge) or releaseHold() on a miss or failure (it is spendable again).
import type { Pool } from 'pg';
import { debit, inTx, release, reserve, settle, type SettleResult, type ReleaseResult } from './ledger';
import { getPrices, SettingsError, type PriceItem } from './settings';

export type ChargeResult =
  | { ok: true; chargedCents: number; balanceAfterCents: number; ledgerId: number; duplicate: boolean }
  | { ok: false; reason: 'disabled' | 'not_priced' | 'insufficient' | 'frozen' | 'settings'; balanceCents?: number };

export async function priceOf(pool: Pool, item: PriceItem): Promise<{ cents: number; enabled: boolean }> {
  return (await getPrices(pool))[item];
}

type Failure = 'disabled' | 'not_priced' | 'settings';
/** Price x quantity for an item, or why it cannot be charged. */
async function totalFor(pool: Pool, item: PriceItem, quantity?: number, quotedCents?: number): Promise<{ ok: true; total: number } | { ok: false; reason: Failure }> {
  let unit: number;
  try {
    const p = await priceOf(pool, item);
    if (!p.enabled) return { ok: false, reason: 'disabled' };
    unit = quotedCents ?? p.cents;
  } catch (e) {
    if (e instanceof SettingsError) return { ok: false, reason: 'settings' };
    throw e;
  }
  const qty = quantity ?? 1;
  const total = unit * qty;
  if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(total) || total <= 0) return { ok: false, reason: 'not_priced' };
  return { ok: true, total };
}

export async function chargeForService(
  pool: Pool,
  o: { userId: number; item: PriceItem; idempotencyKey: string; quantity?: number; quotedCents?: number; ref?: string; description?: string },
): Promise<ChargeResult> {
  const t = await totalFor(pool, o.item, o.quantity, o.quotedCents);
  if (!t.ok) return { ok: false, reason: t.reason };
  const res = await inTx(pool, (c) => debit(c, { userId: o.userId, cents: t.total, kind: 'charge', item: o.item, ref: o.ref, idempotencyKey: o.idempotencyKey, description: o.description }));
  return res.ok ? { ok: true, chargedCents: t.total, balanceAfterCents: res.balanceAfterCents, ledgerId: res.ledgerId, duplicate: res.duplicate } : { ok: false, reason: res.reason, balanceCents: res.balanceCents };
}

export type ReserveForServiceResult =
  | { ok: true; holdId: number; cents: number; duplicate: boolean; status: 'held' | 'settled' | 'released' }
  | { ok: false; reason: Failure | 'insufficient' | 'frozen'; availableCents?: number };

/** Sets the price (x quantity) aside before the service runs. Close it with settleHold() or releaseHold(). */
export async function reserveForService(
  pool: Pool,
  o: { userId: number; item: PriceItem; idempotencyKey: string; quantity?: number; quotedCents?: number; ref?: string; description?: string; ttlSeconds?: number | null },
): Promise<ReserveForServiceResult> {
  const t = await totalFor(pool, o.item, o.quantity, o.quotedCents);
  if (!t.ok) return { ok: false, reason: t.reason };
  const res = await inTx(pool, (c) => reserve(c, { userId: o.userId, cents: t.total, item: o.item, ref: o.ref, idempotencyKey: o.idempotencyKey, description: o.description, ttlSeconds: o.ttlSeconds }));
  return res.ok ? { ok: true, holdId: res.holdId, cents: t.total, duplicate: res.duplicate, status: res.status } : { ok: false, reason: res.reason, availableCents: res.availableCents };
}

/** The service succeeded: the held money becomes a charge (at the reserved amount, or less if actualCents is given). */
export const settleHold = (pool: Pool, holdId: number, o: { actualCents?: number; ref?: string; description?: string } = {}): Promise<SettleResult> =>
  inTx(pool, (c) => settle(c, holdId, o));

/** The service failed or found nothing: the held money is spendable again and nothing is charged. */
export const releaseHold = (pool: Pool, holdId: number, reason?: string): Promise<ReleaseResult> =>
  inTx(pool, (c) => release(c, holdId, reason));
