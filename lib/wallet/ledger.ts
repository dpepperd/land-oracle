// The wallet: a balance per account plus a ledger row for every movement of money.
//   - A balance can never go below zero: debit() checks under a row lock, and the table has CHECK (balance_cents >= 0) as a second guard.
//   - credit() and debit() are idempotent per idempotencyKey (a replayed Stripe event or a double-submitted postcard moves money once).
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

export async function getBalance(db: Pool | PoolClient, userId: number): Promise<number> {
  const r = await db.query('SELECT balance_cents FROM wallet_accounts WHERE user_id = $1', [userId]);
  return Number(r.rows[0]?.balance_cents ?? 0);
}

async function lockAccount(c: PoolClient, userId: number): Promise<number> {
  await c.query('INSERT INTO wallet_accounts (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const r = await c.query('SELECT balance_cents FROM wallet_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
  return Number(r.rows[0].balance_cents);
}

async function move(c: PoolClient, m: MoveInput, signedCents: number): Promise<MoveResult> {
  if (!Number.isInteger(m.cents) || m.cents <= 0) throw new Error('Amount must be a positive whole number of cents.');
  const balance = await lockAccount(c, m.userId); // row lock: two spends by one account run one after the other
  const seen = await c.query('SELECT id, balance_after_cents FROM wallet_ledger WHERE idempotency_key = $1', [m.idempotencyKey]);
  if (seen.rows[0]) return { ok: true, balanceAfterCents: Number(seen.rows[0].balance_after_cents), ledgerId: Number(seen.rows[0].id), duplicate: true };
  const after = balance + signedCents;
  if (after < 0) return { ok: false, reason: 'insufficient', balanceCents: balance };
  await c.query('UPDATE wallet_accounts SET balance_cents = $2, updated_at = now() WHERE user_id = $1', [m.userId, after]);
  const ins = await c.query(
    `INSERT INTO wallet_ledger (user_id, kind, item, amount_cents, balance_after_cents, ref, idempotency_key, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [m.userId, m.kind, m.item ?? null, signedCents, after, m.ref ?? null, m.idempotencyKey, m.description ?? null]);
  return { ok: true, balanceAfterCents: after, ledgerId: Number(ins.rows[0].id), duplicate: false };
}

/** Money in (a top-up, a refund, an adjustment). */
export const credit = (c: PoolClient, m: MoveInput) => move(c, m, m.cents);
/** Money out. Refuses, and records nothing, if the balance is too small. */
export const debit = (c: PoolClient, m: MoveInput) => move(c, m, -m.cents);

export async function recentLedger(db: Pool | PoolClient, userId: number, limit = 50) {
  const r = await db.query(
    'SELECT id, kind, item, amount_cents, balance_after_cents, description, created_at FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
    [userId, limit]);
  return r.rows.map((x) => ({ ...x, amount_cents: Number(x.amount_cents), balance_after_cents: Number(x.balance_after_cents) }));
}
