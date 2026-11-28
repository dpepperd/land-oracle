// Admin view of customer wallets: totals (what we owe customers, what is held, what came in and went out), a searchable list, and one account's
// full history. Read-only: nothing here moves money. Callers (the admin actions) must check requireAdmin() first; this file has no access check of its own.
import type { Pool } from 'pg';
import { likePattern } from '@/lib/searchText';

type Db = Pool;
const n = (v: unknown) => Number(v ?? 0);

export interface WalletOverview {
  wallets: number;
  /** Money customers have in their wallets (we owe them this as services or refunds), held money included. */
  balanceCents: number;
  /** Part of that balance set aside for a service in progress right now. */
  heldCents: number;
  topups30dCents: number;
  /** Charges for services in the last 30 days (our wallet revenue). */
  spend30dCents: number;
  adjustments30dCents: number;
  byItem30d: { item: string; count: number; cents: number }[];
  /** Holds a person must look at: they never expire on their own (a card or lookup was delivered but the charge did not complete). */
  needsAttention: { holdId: number; userId: number; email: string | null; item: string; cents: number; note: string | null; createdAt: string }[];
  /** Holds past their expiry that are still open (freed automatically the next time that account spends). Informational. */
  expiredOpen: { count: number; cents: number };
  /** Open incidents: refunds and disputes that need a person (open chargebacks, lost disputes, money we could not take back). Newest first. */
  incidents: { id: number; userId: number; email: string | null; kind: string; cents: number; ref: string | null; note: string | null; createdAt: string }[];
  /** Wallets that cannot start new spending right now, with the reason code (dispute:<id> for a chargeback). */
  frozen: { userId: number; email: string | null; reason: string | null; since: string }[];
}

export async function walletOverview(db: Db): Promise<WalletOverview> {
  const acct = (await db.query(`SELECT count(*) AS wallets, COALESCE(sum(balance_cents),0) AS balance, COALESCE(sum(held_cents),0) AS held FROM wallet_accounts`)).rows[0];
  const flow = (await db.query(
    `SELECT COALESCE(sum(amount_cents) FILTER (WHERE kind = 'topup'), 0) AS topups,
            COALESCE(-sum(amount_cents) FILTER (WHERE kind = 'charge'), 0) AS spend,
            COALESCE(sum(amount_cents) FILTER (WHERE kind IN ('refund','adjustment')), 0) AS adjustments
       FROM wallet_ledger WHERE created_at > now() - interval '30 days'`)).rows[0];
  const byItem = (await db.query(
    `SELECT item, count(*) AS count, -sum(amount_cents) AS cents FROM wallet_ledger
      WHERE kind = 'charge' AND created_at > now() - interval '30 days' GROUP BY item ORDER BY 3 DESC, 1`)).rows;
  const attention = (await db.query(
    `SELECT h.id, h.user_id, u.email, h.item, h.amount_cents, h.close_reason, h.created_at
       FROM wallet_holds h LEFT JOIN users u ON u.id = h.user_id
      WHERE h.status = 'held' AND h.expires_at IS NULL ORDER BY h.created_at`)).rows;
  const exp = (await db.query(
    `SELECT count(*) AS count, COALESCE(sum(amount_cents),0) AS cents FROM wallet_holds WHERE status = 'held' AND expires_at IS NOT NULL AND expires_at < now()`)).rows[0];
  const inc = (await db.query(
    `SELECT i.id, i.user_id, u.email, i.kind, i.amount_cents, i.ref, i.note, i.created_at FROM wallet_incidents i LEFT JOIN users u ON u.id = i.user_id
      WHERE i.status = 'open' ORDER BY i.id DESC LIMIT 100`)).rows;
  const fro = (await db.query(
    `SELECT a.user_id, u.email, a.frozen_reason, a.frozen_at FROM wallet_accounts a LEFT JOIN users u ON u.id = a.user_id WHERE a.frozen_at IS NOT NULL ORDER BY a.frozen_at DESC`)).rows;
  return {
    wallets: n(acct.wallets), balanceCents: n(acct.balance), heldCents: n(acct.held),
    topups30dCents: n(flow.topups), spend30dCents: n(flow.spend), adjustments30dCents: n(flow.adjustments),
    byItem30d: byItem.map((r) => ({ item: r.item ?? '(none)', count: n(r.count), cents: n(r.cents) })),
    needsAttention: attention.map((r) => ({ holdId: n(r.id), userId: n(r.user_id), email: r.email, item: r.item, cents: n(r.amount_cents), note: r.close_reason, createdAt: new Date(r.created_at).toISOString() })),
    expiredOpen: { count: n(exp.count), cents: n(exp.cents) },
    incidents: inc.map((r) => ({ id: n(r.id), userId: n(r.user_id), email: r.email, kind: r.kind, cents: n(r.amount_cents), ref: r.ref, note: r.note, createdAt: new Date(r.created_at).toISOString() })),
    frozen: fro.map((r) => ({ userId: n(r.user_id), email: r.email, reason: r.frozen_reason, since: new Date(r.frozen_at).toISOString() })),
  };
}

export interface WalletRow {
  userId: number; email: string | null; tier: string | null;
  balanceCents: number; heldCents: number; topupCents: number; spentCents: number; lastActivity: string | null;
}

/** Accounts that have ever had a wallet, newest activity first. `q` filters by email (text typed by the admin is matched literally, 2 characters or more). */
export async function listWallets(db: Db, o: { q?: string; limit?: number; offset?: number } = {}): Promise<WalletRow[]> {
  const q = (o.q ?? '').trim();
  const limit = Math.min(Math.max(Math.trunc(o.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(o.offset ?? 0), 0);
  const r = await db.query(
    `SELECT u.id, u.email, u.subscription_tier AS tier, a.balance_cents, a.held_cents,
            COALESCE((SELECT sum(amount_cents) FROM wallet_ledger l WHERE l.user_id = u.id AND l.kind = 'topup'), 0) AS topup,
            COALESCE((SELECT -sum(amount_cents) FROM wallet_ledger l WHERE l.user_id = u.id AND l.kind = 'charge'), 0) AS spent,
            (SELECT max(created_at) FROM wallet_ledger l WHERE l.user_id = u.id) AS last_activity
       FROM wallet_accounts a JOIN users u ON u.id = a.user_id
      WHERE ($1::text IS NULL OR u.email ILIKE $1)
      ORDER BY last_activity DESC NULLS LAST, u.id LIMIT $2 OFFSET $3`,
    [q.length >= 2 ? likePattern(q) : null, limit, offset]);
  return r.rows.map((x) => ({
    userId: n(x.id), email: x.email, tier: x.tier, balanceCents: n(x.balance_cents), heldCents: n(x.held_cents),
    topupCents: n(x.topup), spentCents: n(x.spent), lastActivity: x.last_activity ? new Date(x.last_activity).toISOString() : null,
  }));
}

export interface WalletDetail {
  user: { id: number; email: string | null; tier: string | null; status: string | null };
  balanceCents: number; heldCents: number; spendableCents: number;
  topupCents: number; spentCents: number;
  spendByItem: { item: string; count: number; cents: number }[];
  ledger: { id: number; kind: string; item: string | null; amountCents: number; balanceAfterCents: number; ref: string | null; description: string | null; createdAt: string }[];
  holds: { id: number; item: string; cents: number; status: string; note: string | null; createdAt: string; closedAt: string | null; expiresAt: string | null }[];
  frozen: { frozen: boolean; reason: string | null; since: string | null };
  topups: { paymentIntent: string; cents: number; refundedCents: number; livemode: boolean; createdAt: string }[];
  disputes: { stripeId: string; cents: number; status: string; reason: string | null; debitedCents: number; shortfallCents: number; reinstatedCents: number; createdAt: string; closedAt: string | null }[];
  incidents: { id: number; kind: string; cents: number; ref: string | null; note: string | null; status: string; resolution: string | null; createdAt: string }[];
}

export async function walletDetail(db: Db, userId: number): Promise<WalletDetail | null> {
  if (!Number.isInteger(userId) || userId < 1) return null;
  const u = (await db.query('SELECT id, email, subscription_tier, subscription_status FROM users WHERE id = $1', [userId])).rows[0];
  if (!u) return null;
  const a = (await db.query('SELECT balance_cents, held_cents, frozen_at, frozen_reason FROM wallet_accounts WHERE user_id = $1', [userId])).rows[0];
  const balance = n(a?.balance_cents), held = n(a?.held_cents);
  const totals = (await db.query(
    `SELECT COALESCE(sum(amount_cents) FILTER (WHERE kind = 'topup'), 0) AS topup, COALESCE(-sum(amount_cents) FILTER (WHERE kind = 'charge'), 0) AS spent FROM wallet_ledger WHERE user_id = $1`, [userId])).rows[0];
  const byItem = (await db.query(
    `SELECT item, count(*) AS count, -sum(amount_cents) AS cents FROM wallet_ledger WHERE user_id = $1 AND kind = 'charge' GROUP BY item ORDER BY 3 DESC, 1`, [userId])).rows;
  const ledger = (await db.query(
    `SELECT id, kind, item, amount_cents, balance_after_cents, ref, description, created_at FROM wallet_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 100`, [userId])).rows;
  const holds = (await db.query(
    `SELECT id, item, amount_cents, status, close_reason, created_at, closed_at, expires_at FROM wallet_holds WHERE user_id = $1 ORDER BY id DESC LIMIT 30`, [userId])).rows;
  const tops = (await db.query('SELECT payment_intent, amount_cents, refunded_cents, livemode, created_at FROM wallet_topups WHERE user_id = $1 ORDER BY id DESC LIMIT 20', [userId])).rows;
  const disp = (await db.query('SELECT stripe_dispute_id, amount_cents, status, reason, debited_cents, shortfall_cents, reinstated_cents, created_at, closed_at FROM wallet_disputes WHERE user_id = $1 ORDER BY id DESC LIMIT 20', [userId])).rows;
  const incs = (await db.query('SELECT id, kind, amount_cents, ref, note, status, resolution, created_at FROM wallet_incidents WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [userId])).rows;
  return {
    user: { id: n(u.id), email: u.email, tier: u.subscription_tier, status: u.subscription_status },
    balanceCents: balance, heldCents: held, spendableCents: balance - held,
    topupCents: n(totals.topup), spentCents: n(totals.spent),
    spendByItem: byItem.map((r) => ({ item: r.item ?? '(none)', count: n(r.count), cents: n(r.cents) })),
    ledger: ledger.map((r) => ({ id: n(r.id), kind: r.kind, item: r.item, amountCents: n(r.amount_cents), balanceAfterCents: n(r.balance_after_cents), ref: r.ref, description: r.description, createdAt: new Date(r.created_at).toISOString() })),
    frozen: { frozen: !!a?.frozen_at, reason: a?.frozen_reason ?? null, since: a?.frozen_at ? new Date(a.frozen_at).toISOString() : null },
    topups: tops.map((r) => ({ paymentIntent: r.payment_intent, cents: n(r.amount_cents), refundedCents: n(r.refunded_cents), livemode: !!r.livemode, createdAt: new Date(r.created_at).toISOString() })),
    disputes: disp.map((r) => ({ stripeId: r.stripe_dispute_id, cents: n(r.amount_cents), status: r.status, reason: r.reason, debitedCents: n(r.debited_cents), shortfallCents: n(r.shortfall_cents), reinstatedCents: n(r.reinstated_cents), createdAt: new Date(r.created_at).toISOString(), closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null })),
    incidents: incs.map((r) => ({ id: n(r.id), kind: r.kind, cents: n(r.amount_cents), ref: r.ref, note: r.note, status: r.status, resolution: r.resolution, createdAt: new Date(r.created_at).toISOString() })),
    holds: holds.map((r) => ({ id: n(r.id), item: r.item, cents: n(r.amount_cents), status: r.status, note: r.close_reason, createdAt: new Date(r.created_at).toISOString(), closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null, expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null })),
  };
}
