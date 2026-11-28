// The wallet: a balance per account plus a ledger row for every movement of money.
//   - A balance can never go below zero: debit() checks under a row lock, and the table has CHECK (balance_cents >= 0) as a second guard.
//   - credit() and debit() are idempotent per idempotencyKey (a replayed Stripe event or a double-submitted postcard moves money once).
//   - Holds (reserve / settle / release) let a service set money aside BEFORE it spends ours (a vendor call, a Lob card): see the section below.
//     Spendable money is balance_cents - held_cents; debit() and reserve() both respect it, and the table refuses held_cents > balance_cents.
//   - Callers run these inside a transaction (BEGIN ... COMMIT) on one client; see inTx().
import type { Pool, PoolClient } from 'pg';

export type Kind = 'topup' | 'charge' | 'refund' | 'adjustment';
export interface MoveInput { userId: number; cents: number; kind: Kind; item?: string; ref?: string; idempotencyKey: string; description?: string }
export type MoveResult =
  | { ok: true; balanceAfterCents: number; ledgerId: number; duplicate: boolean }
  | { ok: false; reason: 'insufficient'; balanceCents: number };

export async function inTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Money the account owns (held money included). */
export async function getBalance(db: Pool | PoolClient, userId: number): Promise<number> {
  const r = await db.query('SELECT balance_cents FROM wallet_accounts WHERE user_id = $1', [userId]);
  return Number(r.rows[0]?.balance_cents ?? 0);
}

/** Money the account can spend right now: the balance minus whatever open holds have set aside. */
export async function getAvailable(db: Pool | PoolClient, userId: number): Promise<number> {
  const r = await db.query('SELECT balance_cents, held_cents FROM wallet_accounts WHERE user_id = $1', [userId]);
  return r.rows[0] ? Number(r.rows[0].balance_cents) - Number(r.rows[0].held_cents) : 0;
}

export async function getHeld(db: Pool | PoolClient, userId: number): Promise<number> {
  const r = await db.query('SELECT held_cents FROM wallet_accounts WHERE user_id = $1', [userId]);
  return Number(r.rows[0]?.held_cents ?? 0);
}

async function lockAccount(c: PoolClient, userId: number): Promise<{ balance: number; held: number }> {
  await c.query('INSERT INTO wallet_accounts (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const r = await c.query('SELECT balance_cents, held_cents FROM wallet_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
  return { balance: Number(r.rows[0].balance_cents), held: Number(r.rows[0].held_cents) };
}

async function move(c: PoolClient, m: MoveInput, signedCents: number): Promise<MoveResult> {
  if (!Number.isInteger(m.cents) || m.cents <= 0) throw new Error('Amount must be a positive whole number of cents.');
  const { balance, held } = await lockAccount(c, m.userId); // row lock: two spends by one account run one after the other
  const seen = await c.query('SELECT id, balance_after_cents FROM wallet_ledger WHERE idempotency_key = $1', [m.idempotencyKey]);
  if (seen.rows[0]) return { ok: true, balanceAfterCents: Number(seen.rows[0].balance_after_cents), ledgerId: Number(seen.rows[0].id), duplicate: true };
  const after = balance + signedCents;
  if (after < held) return { ok: false, reason: 'insufficient', balanceCents: balance - held }; // never spend money that a hold has set aside
  await c.query('UPDATE wallet_accounts SET balance_cents = $2, updated_at = now() WHERE user_id = $1', [m.userId, after]);
  const ins = await c.query(
    `INSERT INTO wallet_ledger (user_id, kind, item, amount_cents, balance_after_cents, ref, idempotency_key, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [m.userId, m.kind, m.item ?? null, signedCents, after, m.ref ?? null, m.idempotencyKey, m.description ?? null]);
  return { ok: true, balanceAfterCents: after, ledgerId: Number(ins.rows[0].id), duplicate: false };
}

/** Money in (a top-up, a refund, an adjustment). */
export const credit = (c: PoolClient, m: MoveInput) => move(c, m, m.cents);
/** Money out. Refuses, and records nothing, if the spendable balance is too small. */
export const debit = (c: PoolClient, m: MoveInput) => move(c, m, -m.cents);

export async function recentLedger(db: Pool | PoolClient, userId: number, limit = 50) {
  const r = await db.query(
    'SELECT id, kind, item, amount_cents, balance_after_cents, description, created_at FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
    [userId, limit]);
  return r.rows.map((x) => ({ ...x, amount_cents: Number(x.amount_cents), balance_after_cents: Number(x.balance_after_cents) }));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Holds. A service that spends our money before it knows the outcome (a skip trace vendor call, a Lob postcard) works like this:
//   reserve  -> sets the money aside (balance unchanged, nothing in the ledger, spendable money drops)
//   settle   -> the service succeeded: the hold becomes a real 'charge' (one ledger row), at the reserved amount or less
//   release  -> the service failed or found nothing: the money is spendable again, no ledger row (it never left)
// Every step is idempotent, so a retry cannot hold or charge twice. A hold nobody closes expires (HOLD_TTL_SECONDS) and is freed
// the next time that account reserves something.
// ---------------------------------------------------------------------------------------------------------------------------------
export const HOLD_TTL_SECONDS = 600;

export interface ReserveInput { userId: number; cents: number; item: string; idempotencyKey: string; ref?: string; description?: string; ttlSeconds?: number | null }
export type ReserveResult =
  | { ok: true; holdId: number; duplicate: boolean; status: 'held' | 'settled' | 'released' }
  | { ok: false; reason: 'insufficient'; availableCents: number };
export type SettleResult =
  | { ok: true; chargedCents: number; balanceAfterCents: number; ledgerId: number; duplicate: boolean }
  | { ok: false; reason: 'not_found' | 'released' | 'invalid_amount' };
export type ReleaseResult = { ok: true; releasedCents: number; duplicate: boolean } | { ok: false; reason: 'not_found' | 'already_settled' };

/** Frees this account's expired holds (inside the caller's transaction, with the account row already locked). */
async function freeExpired(c: PoolClient, userId: number): Promise<void> {
  const r = await c.query(
    `UPDATE wallet_holds SET status = 'released', closed_at = now(), close_reason = 'expired'
      WHERE user_id = $1 AND status = 'held' AND expires_at IS NOT NULL AND expires_at < now() RETURNING amount_cents`, [userId]);
  const freed = r.rows.reduce((n, x) => n + Number(x.amount_cents), 0);
  if (freed > 0) await c.query('UPDATE wallet_accounts SET held_cents = held_cents - $2, updated_at = now() WHERE user_id = $1', [userId, freed]);
}

export async function reserve(c: PoolClient, m: ReserveInput): Promise<ReserveResult> {
  if (!Number.isInteger(m.cents) || m.cents <= 0) throw new Error('Amount must be a positive whole number of cents.');
  await lockAccount(c, m.userId);
  const seen = (await c.query('SELECT id, status FROM wallet_holds WHERE idempotency_key = $1', [m.idempotencyKey])).rows[0];
  if (seen) return { ok: true, holdId: Number(seen.id), duplicate: true, status: seen.status };
  await freeExpired(c, m.userId);
  const { balance, held } = await lockAccount(c, m.userId); // re-read after freeing expired holds
  if (m.cents > balance - held) return { ok: false, reason: 'insufficient', availableCents: balance - held };
  const ttl = m.ttlSeconds === undefined ? HOLD_TTL_SECONDS : m.ttlSeconds;
  const ins = await c.query(
    `INSERT INTO wallet_holds (user_id, item, amount_cents, ref, description, idempotency_key, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $7::int IS NULL THEN NULL ELSE now() + ($7::int || ' seconds')::interval END) RETURNING id`,
    [m.userId, m.item, m.cents, m.ref ?? null, m.description ?? null, m.idempotencyKey, ttl]);
  await c.query('UPDATE wallet_accounts SET held_cents = held_cents + $2, updated_at = now() WHERE user_id = $1', [m.userId, m.cents]);
  return { ok: true, holdId: Number(ins.rows[0].id), duplicate: false, status: 'held' };
}

async function loadHold(c: PoolClient, holdId: number) {
  const first = (await c.query('SELECT user_id FROM wallet_holds WHERE id = $1', [holdId])).rows[0];
  if (!first) return null;
  await lockAccount(c, Number(first.user_id)); // same lock order as reserve: account row first, then the hold row
  return (await c.query('SELECT * FROM wallet_holds WHERE id = $1 FOR UPDATE', [holdId])).rows[0] ?? null;
}

/** The service succeeded: turn the hold into a charge. actualCents (1 up to the reserved amount) lets a service charge less than it reserved. */
export async function settle(c: PoolClient, holdId: number, o: { actualCents?: number; ref?: string; description?: string } = {}): Promise<SettleResult> {
  const h = await loadHold(c, holdId);
  if (!h) return { ok: false, reason: 'not_found' };
  if (h.status === 'settled') {
    const lr = (await c.query('SELECT balance_after_cents FROM wallet_ledger WHERE id = $1', [h.ledger_id])).rows[0];
    return { ok: true, chargedCents: Number(h.settled_cents), balanceAfterCents: Number(lr?.balance_after_cents ?? 0), ledgerId: Number(h.ledger_id), duplicate: true };
  }
  if (h.status === 'released') return { ok: false, reason: 'released' };
  const reserved = Number(h.amount_cents);
  const actual = o.actualCents ?? reserved;
  if (!Number.isInteger(actual) || actual < 1 || actual > reserved) return { ok: false, reason: 'invalid_amount' };
  const acct = (await c.query('SELECT balance_cents FROM wallet_accounts WHERE user_id = $1', [h.user_id])).rows[0];
  const after = Number(acct.balance_cents) - actual;
  await c.query('UPDATE wallet_accounts SET balance_cents = $2, held_cents = held_cents - $3, updated_at = now() WHERE user_id = $1', [h.user_id, after, reserved]);
  const ins = await c.query(
    `INSERT INTO wallet_ledger (user_id, kind, item, amount_cents, balance_after_cents, ref, idempotency_key, description)
     VALUES ($1,'charge',$2,$3,$4,$5,$6,$7) RETURNING id`,
    [h.user_id, h.item, -actual, after, o.ref ?? h.ref, `hold:${holdId}:settle`, o.description ?? h.description]);
  await c.query(`UPDATE wallet_holds SET status = 'settled', settled_cents = $2, ledger_id = $3, closed_at = now(), close_reason = 'settled' WHERE id = $1`, [holdId, actual, ins.rows[0].id]);
  return { ok: true, chargedCents: actual, balanceAfterCents: after, ledgerId: Number(ins.rows[0].id), duplicate: false };
}

/** The service failed or found nothing: the money becomes spendable again. No ledger row (it never left the balance). */
export async function release(c: PoolClient, holdId: number, reason = 'released'): Promise<ReleaseResult> {
  const h = await loadHold(c, holdId);
  if (!h) return { ok: false, reason: 'not_found' };
  if (h.status === 'settled') return { ok: false, reason: 'already_settled' };
  if (h.status === 'released') return { ok: true, releasedCents: Number(h.amount_cents), duplicate: true };
  await c.query('UPDATE wallet_accounts SET held_cents = held_cents - $2, updated_at = now() WHERE user_id = $1', [h.user_id, h.amount_cents]);
  await c.query(`UPDATE wallet_holds SET status = 'released', closed_at = now(), close_reason = $2 WHERE id = $1`, [holdId, reason]);
  return { ok: true, releasedCents: Number(h.amount_cents), duplicate: false };
}

/** A hold that must be looked at by a person (for example a card was sent but the charge would not complete): it never expires on its own. */
export async function keepHold(c: PoolClient, holdId: number, note: string): Promise<void> {
  await c.query(`UPDATE wallet_holds SET expires_at = NULL, close_reason = $2 WHERE id = $1 AND status = 'held'`, [holdId, note]);
}
