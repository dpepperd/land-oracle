// Sending a postcard. The order matters and is tested in scripts/ai/test-wallet.ts:
//   1. price and balance check (too little money: stop, nothing sent, nothing charged)
//   2. Lob's US address verification (undeliverable: stop, nothing sent, nothing charged, the user is told why)
//   3. Lob creates the postcard
//   4. ONLY NOW the wallet is charged (the card was accepted)
// An advisory lock per account makes one account's postcard sends run one after the other, so the balance checked in step 1 is still there at step 4.
// If the charge somehow still fails after Lob accepted the card, we ask Lob to cancel it and record that.
import type { Pool } from 'pg';
import { z } from 'zod';
import { debit, getBalance, inTx } from './ledger';
import { getPrices, getReturnAddress, SettingsError } from './settings';
import { LobError, type LobClient, type UsAddress } from './lob';

export const MESSAGE_MAX = 300;

export const postcardSchema = z.object({
  parcelKey: z.string().max(80).optional(),
  message: z.string().trim().min(1, 'Write a message for the card.').max(MESSAGE_MAX, `Keep the message to ${MESSAGE_MAX} characters.`),
  to: z.object({
    name: z.string().trim().min(1, 'Recipient name is required.').max(80),
    line1: z.string().trim().min(1, 'Street address is required.').max(100),
    line2: z.string().trim().max(100).optional().default(''),
    city: z.string().trim().min(1, 'City is required.').max(60),
    state: z.string().trim().length(2, 'Use the 2-letter state, like FL.').transform((s) => s.toUpperCase()),
    zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 digits (or ZIP+4).'),
  }),
});
export type PostcardInput = z.infer<typeof postcardSchema>;

export type SendResult =
  | { ok: true; postcardId: number; lobId: string; chargedCents: number; balanceAfterCents: number }
  | { ok: false; code: 'insufficient_funds' | 'address_rejected' | 'not_set_up' | 'mail_failed' | 'busy'; message: string; postcardId?: number; balanceCents?: number; priceCents?: number };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// 4x6 postcard, Lob's 6.25in x 4.25in print area. The right side of the back is left empty on purpose: Lob prints the address block there.
export const frontHtml = (message: string) =>
  `<html><head><style>body{margin:0;width:6.25in;height:4.25in;font-family:Arial,Helvetica,sans-serif}.m{position:absolute;top:.5in;left:.5in;width:5.25in;font-size:15pt;line-height:1.35;color:#111}</style></head><body><div class="m">${esc(message).replace(/\n/g, '<br>')}</div></body></html>`;
export const backHtml = (fromName: string) =>
  `<html><head><style>body{margin:0;width:6.25in;height:4.25in;font-family:Arial,Helvetica,sans-serif}.f{position:absolute;top:.4in;left:.4in;width:2.6in;font-size:9pt;color:#444}</style></head><body><div class="f">From ${esc(fromName)}</div></body></html>`;

export async function sendPostcard(deps: { pool: Pool; lob: LobClient }, userId: number, input: PostcardInput): Promise<SendResult> {
  const { pool, lob } = deps;

  // One send at a time per account (held on its own connection until we are done).
  const lock = await pool.connect();
  try {
    const got = (await lock.query('SELECT pg_try_advisory_lock(7001, $1) AS ok', [userId])).rows[0].ok;
    if (!got) return { ok: false, code: 'busy', message: 'Another postcard from your account is still being sent. Try again in a moment.' };
    try {
      return await run(pool, lob, userId, input);
    } finally {
      await lock.query('SELECT pg_advisory_unlock(7001, $1)', [userId]).catch(() => {});
    }
  } finally {
    lock.release();
  }
}

async function run(pool: Pool, lob: LobClient, userId: number, input: PostcardInput): Promise<SendResult> {
  // 1. price (from admin settings), return address, balance
  let price: number;
  let from;
  try {
    price = (await getPrices(pool)).postcard;
    if (!Number.isInteger(price) || price <= 0) throw new SettingsError('The postcard price is not set.');
    from = await getReturnAddress(pool);
  } catch (e: any) {
    if (e instanceof SettingsError) return { ok: false, code: 'not_set_up', message: 'Postcards are not set up yet.' };
    throw e;
  }
  if (!from) return { ok: false, code: 'not_set_up', message: 'Postcards are not set up yet (no return address).' };
  const balance = await getBalance(pool, userId);
  if (balance < price) return { ok: false, code: 'insufficient_funds', message: 'Not enough wallet balance for a postcard. Add funds first.', balanceCents: balance, priceCents: price };

  const to = input.to;
  const row = (await pool.query(
    `INSERT INTO postcards (user_id, parcel_key, to_name, to_line1, to_line2, to_city, to_state, to_zip, message, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sending') RETURNING id`,
    [userId, input.parcelKey ?? null, to.name, to.line1, to.line2 || null, to.city, to.state, to.zip, input.message])).rows[0];
  const id = Number(row.id);
  const setStatus = (status: string, reason: string | null, extra: { lobId?: string; cost?: number; ledgerId?: number } = {}) =>
    pool.query('UPDATE postcards SET status=$2, reason=$3, lob_id=COALESCE($4, lob_id), cost_cents=COALESCE($5, cost_cents), ledger_id=COALESCE($6, ledger_id) WHERE id=$1',
      [id, status, reason, extra.lobId ?? null, extra.cost ?? null, extra.ledgerId ?? null]);

  // 2. address verification: a bad address stops here, free
  const toAddr: UsAddress = { name: to.name, line1: to.line1, line2: to.line2 || undefined, city: to.city, state: to.state, zip: to.zip };
  let verified;
  try {
    verified = await lob.verify(toAddr);
  } catch (e: any) {
    const msg = e instanceof LobError && (e.code === 'not_configured' || e.code === 'live_key_blocked') ? e.message : 'We could not check the address right now, so nothing was sent or charged. Please try again.';
    await setStatus('failed', msg);
    return { ok: false, code: e instanceof LobError && e.code !== 'unavailable' ? 'not_set_up' : 'mail_failed', message: msg, postcardId: id };
  }
  if (!verified.ok) {
    await setStatus('rejected_address', verified.reason);
    return { ok: false, code: 'address_rejected', message: verified.reason + ' Nothing was sent and you were not charged.', postcardId: id };
  }

  // 3. Lob creates the card (the postcard id is the idempotency key: a retry cannot mail a second card)
  let lobId: string;
  try {
    lobId = (await lob.createPostcard({
      to: verified.address,
      from: { name: from.name, line1: from.address_line1, line2: from.address_line2 || undefined, city: from.city, state: from.state, zip: from.zip },
      front: frontHtml(input.message), back: backHtml(from.name), description: `Land Oracle postcard ${id}`, idempotencyKey: `landoracle-postcard-${id}`,
    })).id;
  } catch (e: any) {
    const msg = e instanceof LobError && e.code === 'rejected' ? `The mailing service refused the card: ${e.message}` : 'The postcard could not be sent right now. You were not charged. Please try again.';
    await setStatus('failed', msg);
    return { ok: false, code: 'mail_failed', message: msg + (e instanceof LobError && e.code === 'rejected' ? ' You were not charged.' : ''), postcardId: id };
  }

  // 4. Lob accepted the card: charge the wallet now
  try {
    const res = await inTx(pool, (c) => debit(c, { userId, cents: price, kind: 'charge', item: 'postcard', ref: lobId, idempotencyKey: `postcard:${id}`, description: `Postcard to ${to.city}, ${to.state}` }));
    if (!res.ok) {
      await lob.cancelPostcard(lobId).catch(() => {});
      await setStatus('sent_unpaid_cancel_requested', 'The balance was too low at the moment of charging; cancellation was requested.', { lobId });
      return { ok: false, code: 'insufficient_funds', message: 'Your balance changed and is now too low. The card was cancelled.', postcardId: id, balanceCents: res.balanceCents, priceCents: price };
    }
    await setStatus('sent', null, { lobId, cost: price, ledgerId: res.ledgerId });
    return { ok: true, postcardId: id, lobId, chargedCents: price, balanceAfterCents: res.balanceAfterCents };
  } catch {
    await lob.cancelPostcard(lobId).catch(() => {});
    await setStatus('sent_unpaid_cancel_requested', 'Charging failed after the card was accepted; cancellation was requested.', { lobId }).catch(() => {});
    return { ok: false, code: 'mail_failed', message: 'Something went wrong while charging your wallet. The card was cancelled and you were not charged.', postcardId: id };
  }
}
