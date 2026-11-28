// Refunds and disputes (chargebacks) on wallet top-ups, plus the admin tools that go with them. See docs/wallet.md.
//
// A top-up is a Stripe payment that was credited to the wallet. If Stripe later gives that money back to the customer (a refund) or takes it
// back from us (a dispute), the wallet must give it up too, or the customer keeps both the money and the services.
//   - Refund:  the wallet is reduced by the amount refunded (a running total, so partial refunds, replays and out-of-order events are all safe).
//   - Dispute: when it opens, the disputed amount is taken back from the wallet right away and the wallet is FROZEN (no new spending) until it ends.
//              Won: the money is returned and the wallet unfrozen (if nothing else is open). Lost: the money stays gone and the wallet stays frozen for review.
//   - Only SPENDABLE money can be taken back (not money set aside for a service in progress). Whatever could not be taken back is a SHORTFALL:
//     it is recorded as an incident for an admin, never as a negative balance.
// Everything runs inside the Stripe webhook's transaction and is idempotent. Charges that are not wallet top-ups (subscriptions) are ignored here.
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { clawback, credit, debitByAdmin, freezeAccount, inTx, unfreezeAccount } from './ledger';

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === 'string' ? v : v?.id ?? null);
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const n = (v: unknown) => Number(v ?? 0);

export type WebhookResult = { applied: boolean; reason?: string; [k: string]: unknown };

/** Remembers which Stripe payment a credited top-up belongs to, so a later refund or dispute can find it. Safe to call again for the same payment. */
export async function recordTopup(c: PoolClient, o: { userId: number; paymentIntent: string | null; sessionId: string; amountCents: number; livemode: boolean }): Promise<void> {
  if (!o.paymentIntent) { console.error('[wallet] top-up credited without a payment id; a refund or dispute for it could not be matched:', o.sessionId); return; }
  await c.query(
    `INSERT INTO wallet_topups (user_id, payment_intent, session_id, amount_cents, livemode) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [o.userId, o.paymentIntent, o.sessionId, o.amountCents, o.livemode]);
}

async function topupFor(c: PoolClient, paymentIntent: string | null) {
  if (!paymentIntent) return null;
  return (await c.query('SELECT * FROM wallet_topups WHERE payment_intent = $1 FOR UPDATE', [paymentIntent])).rows[0] ?? null;
}

async function openIncident(c: PoolClient, o: { userId: number; kind: string; cents: number; ref: string; note: string }): Promise<void> {
  const dup = await c.query(`SELECT 1 FROM wallet_incidents WHERE kind = $1 AND ref = $2 AND amount_cents = $3 AND status = 'open'`, [o.kind, o.ref, o.cents]);
  if (dup.rowCount) return;
  await c.query('INSERT INTO wallet_incidents (user_id, kind, amount_cents, ref, note) VALUES ($1,$2,$3,$4,$5)', [o.userId, o.kind, o.cents, o.ref, o.note]);
}

// ---------------------------------------------------------------------------------------------------------------- refunds
/** `charge.refunded`: take back what Stripe refunded to the customer. */
export async function applyChargeRefund(c: PoolClient, charge: Stripe.Charge): Promise<WebhookResult> {
  const topup = await topupFor(c, idOf(charge.payment_intent as any));
  if (!topup) return { applied: false, reason: 'not a wallet top-up' };
  const total = n(charge.amount_refunded);
  const delta = total - n(topup.refunded_cents);
  if (delta <= 0) return { applied: false, reason: 'already applied' }; // a replay, or an older event arriving after a newer one
  const cb = await clawback(c, { userId: topup.user_id, cents: delta, kind: 'refund', ref: charge.id, idempotencyKey: `refund:${charge.id}:${total}`, description: `Refund of ${usd(delta)} on a wallet top-up` });
  await c.query('UPDATE wallet_topups SET refunded_cents = $2 WHERE id = $1', [topup.id, total]);
  if (cb.shortfallCents > 0) {
    await openIncident(c, {
      userId: topup.user_id, kind: 'refund_shortfall', cents: cb.shortfallCents, ref: `${charge.id}:${total}`,
      note: `Stripe refunded ${usd(delta)} on a wallet top-up, but only ${usd(cb.takenCents)} was still spendable in the wallet. ${usd(cb.shortfallCents)} was already spent on services (or is set aside for one in progress).`,
    });
  }
  return { applied: true, refundedCents: delta, takenCents: cb.takenCents, shortfallCents: cb.shortfallCents };
}

// ---------------------------------------------------------------------------------------------------------------- disputes
/** `charge.dispute.created`: take the disputed amount back right away and freeze the wallet (an inquiry only creates an incident: no money has moved). */
export async function applyDisputeCreated(c: PoolClient, d: Stripe.Dispute): Promise<WebhookResult> {
  const pi = idOf(d.payment_intent as any);
  const topup = await topupFor(c, pi);
  if (!topup) return { applied: false, reason: 'not a wallet top-up' };
  if ((await c.query('SELECT 1 FROM wallet_disputes WHERE stripe_dispute_id = $1', [d.id])).rowCount) return { applied: false, reason: 'already recorded' };
  const amount = n(d.amount);
  if (!(amount > 0)) return { applied: false, reason: 'no amount' };
  const reason = d.reason ?? 'unknown';
  const dueBy = (d as any).evidence_details?.due_by ? new Date((d as any).evidence_details.due_by * 1000).toLocaleDateString('en-US') : 'see Stripe';

  if (String(d.status).startsWith('warning_')) {
    await c.query(`INSERT INTO wallet_disputes (user_id, stripe_dispute_id, payment_intent, amount_cents, reason, status) VALUES ($1,$2,$3,$4,$5,'inquiry')`, [topup.user_id, d.id, pi, amount, reason]);
    await openIncident(c, { userId: topup.user_id, kind: 'dispute_open', cents: amount, ref: d.id, note: `Payment inquiry (not yet a chargeback): ${usd(amount)}, reason ${reason}. No money has moved and the wallet is not paused. Respond in the Stripe dashboard if needed.` });
    return { applied: true, inquiry: true };
  }

  const cb = await clawback(c, { userId: topup.user_id, cents: amount, kind: 'adjustment', ref: d.id, idempotencyKey: `dispute:${d.id}:debit`, description: `Payment dispute opened: ${usd(amount)} taken back while it is reviewed` });
  await c.query(
    `INSERT INTO wallet_disputes (user_id, stripe_dispute_id, payment_intent, amount_cents, reason, status, debited_cents, shortfall_cents) VALUES ($1,$2,$3,$4,$5,'open',$6,$7)`,
    [topup.user_id, d.id, pi, amount, reason, cb.takenCents, cb.shortfallCents]);
  await freezeAccount(c, topup.user_id, `dispute:${d.id}`);
  await openIncident(c, {
    userId: topup.user_id, kind: 'dispute_open', cents: amount, ref: d.id,
    note: `Chargeback of ${usd(amount)} (reason: ${reason}). Evidence due ${dueBy}: respond in the Stripe dashboard. ${usd(cb.takenCents)} was taken back from the wallet and the wallet is paused.`,
  });
  if (cb.shortfallCents > 0) {
    await openIncident(c, { userId: topup.user_id, kind: 'dispute_shortfall', cents: cb.shortfallCents, ref: d.id, note: `Only ${usd(cb.takenCents)} of the disputed ${usd(amount)} could be taken back; ${usd(cb.shortfallCents)} was already spent on services.` });
  }
  return { applied: true, debitedCents: cb.takenCents, shortfallCents: cb.shortfallCents, frozen: true };
}

/** `charge.dispute.closed`: won (or an inquiry closed) returns the money and unfreezes; lost leaves it gone and the wallet frozen for an admin. */
export async function applyDisputeClosed(c: PoolClient, d: Stripe.Dispute): Promise<WebhookResult> {
  let row = (await c.query('SELECT * FROM wallet_disputes WHERE stripe_dispute_id = $1 FOR UPDATE', [d.id])).rows[0];
  if (!row) { // the "created" event never reached us: record it now (as open, unless it was only an inquiry), then close it below
    const status = String(d.status).startsWith('warning_') ? d.status : 'needs_response';
    await applyDisputeCreated(c, { ...d, status } as Stripe.Dispute);
    row = (await c.query('SELECT * FROM wallet_disputes WHERE stripe_dispute_id = $1 FOR UPDATE', [d.id])).rows[0];
    if (!row) return { applied: false, reason: 'not a wallet top-up' };
  }
  if (row.status !== 'open' && row.status !== 'inquiry') return { applied: false, reason: 'already closed' };
  const st = String(d.status);
  const userId = n(row.user_id);

  if (st === 'won' || st === 'warning_closed') {
    const back = n(row.debited_cents);
    if (back > 0) await credit(c, { userId, cents: back, kind: 'adjustment', ref: d.id, idempotencyKey: `dispute:${d.id}:reinstate`, description: 'Payment dispute resolved in our favour: the amount was returned to your wallet' });
    await c.query(`UPDATE wallet_disputes SET status = $2, reinstated_cents = $3, closed_at = now() WHERE id = $1`, [row.id, row.status === 'inquiry' ? 'inquiry_closed' : 'won', back]);
    await c.query(`UPDATE wallet_incidents SET status = 'resolved', resolved_at = now(), resolution = 'Dispute closed in our favour' WHERE ref = $1 AND kind IN ('dispute_open','dispute_shortfall') AND status = 'open'`, [d.id]);
    const stillOpen = n((await c.query(`SELECT count(*) AS n FROM wallet_disputes WHERE user_id = $1 AND status = 'open'`, [userId])).rows[0].n);
    const fz = (await c.query('SELECT frozen_reason FROM wallet_accounts WHERE user_id = $1', [userId])).rows[0]?.frozen_reason ?? '';
    const unfroze = stillOpen === 0 && String(fz).startsWith('dispute:');
    if (unfroze) await unfreezeAccount(c, userId);
    return { applied: true, outcome: 'won', reinstatedCents: back, unfrozen: unfroze };
  }
  if (st === 'lost') {
    await c.query(`UPDATE wallet_disputes SET status = 'lost', closed_at = now() WHERE id = $1`, [row.id]);
    await c.query(`UPDATE wallet_incidents SET status = 'resolved', resolved_at = now(), resolution = 'Dispute closed: lost (see the lost-dispute incident)' WHERE ref = $1 AND kind = 'dispute_open' AND status = 'open'`, [d.id]);
    await openIncident(c, {
      userId, kind: 'dispute_lost', cents: n(row.amount_cents), ref: d.id,
      note: `Dispute LOST: Stripe keeps ${usd(n(row.amount_cents))} plus its dispute fee. ${usd(n(row.debited_cents))} was taken back from the wallet; ${usd(n(row.shortfall_cents))} could not be. The wallet stays paused until you review and unpause it.`,
    });
    return { applied: true, outcome: 'lost', frozen: true };
  }
  return { applied: false, reason: `status ${st} ignored` };
}

// ---------------------------------------------------------------------------------------------------------------- admin tools (no access check here: the admin actions call requireAdmin first)
export type AdminOpResult = { ok: true; message: string } | { ok: false; message: string };
const MAX_ADJUST_CENTS = 100_000; // $1,000 per adjustment

/** Lets a frozen wallet spend again. Needs a note; leaves an audit row. */
export async function adminUnfreeze(pool: Pool, o: { userId: number; adminId: number | null; note: string }): Promise<AdminOpResult> {
  const note = o.note.trim();
  if (note.length < 3 || note.length > 200) return { ok: false, message: 'Write a short note (3 to 200 characters) saying why.' };
  return inTx(pool, async (c) => {
    const a = (await c.query('SELECT frozen_at FROM wallet_accounts WHERE user_id = $1 FOR UPDATE', [o.userId])).rows[0];
    if (!a?.frozen_at) return { ok: false as const, message: 'That wallet is not paused.' };
    await unfreezeAccount(c, o.userId);
    await c.query(`INSERT INTO wallet_incidents (user_id, kind, note, status, resolved_at, resolution) VALUES ($1,'manual',$2,'resolved',now(),'done')`, [o.userId, `Wallet unpaused by admin ${o.adminId ?? '?'}: ${note}`]);
    return { ok: true as const, message: 'The wallet is active again.' };
  });
}

/** Marks an incident as dealt with, with a note. */
export async function adminResolveIncident(pool: Pool, o: { incidentId: number; adminId: number | null; note: string }): Promise<AdminOpResult> {
  const note = o.note.trim();
  if (note.length < 3 || note.length > 200) return { ok: false, message: 'Write a short note (3 to 200 characters) saying what was done.' };
  const r = await pool.query(`UPDATE wallet_incidents SET status = 'resolved', resolved_at = now(), resolution = $2 WHERE id = $1 AND status = 'open' RETURNING id`, [o.incidentId, `${note} (admin ${o.adminId ?? '?'})`]);
  return r.rowCount ? { ok: true, message: 'Marked as dealt with.' } : { ok: false, message: 'That item was not found or is already closed.' };
}

/** Adds or removes money by hand (a goodwill credit, fixing a shortfall). Needs a reason; leaves an audit row. One click, one change (the token stops a double submit). */
export async function adminAdjust(pool: Pool, o: { userId: number; cents: number; adminId: number | null; reason: string; token: string }): Promise<AdminOpResult> {
  const reason = o.reason.trim();
  if (!Number.isInteger(o.cents) || o.cents === 0) return { ok: false, message: 'Enter an amount.' };
  if (Math.abs(o.cents) > MAX_ADJUST_CENTS) return { ok: false, message: `One adjustment can be at most ${usd(MAX_ADJUST_CENTS)}.` };
  if (reason.length < 3 || reason.length > 200) return { ok: false, message: 'Write a reason (3 to 200 characters).' };
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(o.token)) return { ok: false, message: 'Reload the page and try again.' };
  return inTx(pool, async (c) => {
    if (!(await c.query('SELECT 1 FROM users WHERE id = $1', [o.userId])).rowCount) return { ok: false as const, message: 'Account not found.' };
    const m = { userId: o.userId, cents: Math.abs(o.cents), kind: 'adjustment' as const, ref: `admin:${o.adminId ?? '?'}`, idempotencyKey: `adjust:${o.token}`, description: `Account adjustment: ${reason}` };
    const res = o.cents > 0 ? await credit(c, m) : await debitByAdmin(c, m);
    if (!res.ok) return { ok: false as const, message: `Not enough spendable money to remove ${usd(Math.abs(o.cents))} (money set aside for a service in progress cannot be removed).` };
    if (!res.duplicate) await c.query(`INSERT INTO wallet_incidents (user_id, kind, amount_cents, note, status, resolved_at, resolution) VALUES ($1,'manual',$2,$3,'resolved',now(),'done')`, [o.userId, o.cents, `${o.cents > 0 ? 'Added' : 'Removed'} ${usd(Math.abs(o.cents))} by admin ${o.adminId ?? '?'}: ${reason}`]);
    return { ok: true as const, message: res.duplicate ? 'That adjustment was already made.' : `${o.cents > 0 ? 'Added' : 'Removed'} ${usd(Math.abs(o.cents))}. New balance ${usd(res.balanceAfterCents)}.` };
  });
}
