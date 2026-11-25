// The one door every paid service uses to charge the wallet (postcards now; skip trace, property data, permits and monitor alerts later).
//   - the price comes from admin settings (app_settings), never from the caller's code;
//   - an item that is switched off, or has no price, cannot be charged;
//   - the money moves through ledger.debit(), so a balance can never go negative and an idempotency key charges once.
// A service that already showed the user a price may pass quotedCents so the user pays what they were shown.
import type { Pool } from 'pg';
import { debit, inTx } from './ledger';
import { getPrices, SettingsError, type PriceItem } from './settings';

export type ChargeResult =
  | { ok: true; chargedCents: number; balanceAfterCents: number; ledgerId: number; duplicate: boolean }
  | { ok: false; reason: 'disabled' | 'not_priced' | 'insufficient' | 'settings'; balanceCents?: number };

export async function priceOf(pool: Pool, item: PriceItem): Promise<{ cents: number; enabled: boolean }> {
  return (await getPrices(pool))[item];
}

export async function chargeForService(
  pool: Pool,
  o: { userId: number; item: PriceItem; idempotencyKey: string; quantity?: number; quotedCents?: number; ref?: string; description?: string },
): Promise<ChargeResult> {
  let unit: number;
  try {
    const p = await priceOf(pool, o.item);
    if (!p.enabled) return { ok: false, reason: 'disabled' };
    unit = o.quotedCents ?? p.cents;
  } catch (e) {
    if (e instanceof SettingsError) return { ok: false, reason: 'settings' };
    throw e;
  }
  const qty = o.quantity ?? 1;
  const total = unit * qty;
  if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(total) || total <= 0) return { ok: false, reason: 'not_priced' };
  const res = await inTx(pool, (c) => debit(c, { userId: o.userId, cents: total, kind: 'charge', item: o.item, ref: o.ref, idempotencyKey: o.idempotencyKey, description: o.description }));
  return res.ok ? { ok: true, chargedCents: total, balanceAfterCents: res.balanceAfterCents, ledgerId: res.ledgerId, duplicate: res.duplicate } : { ok: false, reason: 'insufficient', balanceCents: res.balanceCents };
}
