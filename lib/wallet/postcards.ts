// Sending a postcard. The order matters and is tested in scripts/ai/test-wallet.ts:
//   1. price (per size, from admin settings) and spendable-balance check (too little money: stop, nothing sent, nothing charged)
//   2. Lob's US address verification (undeliverable: stop, nothing sent, nothing charged, the user is told why)
//   3. the price is RESERVED in the wallet (set aside, not yet charged): no other spend can take that money while the card is being made
//   4. Lob creates the postcard (First Class); if Lob refuses it, the hold is released and nothing is charged
//   5. ONLY NOW the hold becomes the charge (the card was accepted), at the price the user was shown
// An advisory lock per account makes one account's postcard sends run one after the other.
// If the charge cannot be completed after Lob accepted the card, the card stays sent and the held money stays held for a person to settle.
import type { Pool } from 'pg';
import { z } from 'zod';
import { getAvailable, inTx, keepHold } from './ledger';
import { releaseHold, reserveForService, settleHold } from './charge';
import { getPrices, getReturnAddress, postcardItem, SettingsError } from './settings';
import { LobError, type LobClient, type UsAddress } from './lob';
import { applyMerge, messageMax, normalizePhone, renderPostcard, SIZES, type DesignId, type PostcardSize, type PostcardSpec, type Rendered } from './templates';

export const postcardSchema = z.object({
  size: z.enum(SIZES).default('4x6'),
  design: z.enum(['classic', 'bold', 'friendly']).default('classic'),
  parcelKey: z.string().max(80).optional(),
  message: z.string().trim().min(1, 'Write a message for the back of the card.').max(1000),
  agent: z.object({
    name: z.string().trim().min(2, 'Agent name is required.').max(60),
    phone: z.string().trim().min(1, 'Agent phone is required.').max(30),
    brokerage: z.string().trim().min(2, 'Brokerage name is required.').max(80),
  }),
  to: z.object({
    name: z.string().trim().min(1, 'Owner name is required.').max(80),
    line1: z.string().trim().min(1, 'Street address is required.').max(100),
    line2: z.string().trim().max(100).optional().default(''),
    city: z.string().trim().min(1, 'City is required.').max(60),
    state: z.string().trim().length(2, 'Use the 2-letter state, like FL.').transform((s) => s.toUpperCase()),
    zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 digits (or ZIP+4).'),
  }),
  propertyAddress: z.string().trim().max(80, 'Keep the property address to 80 characters.').optional(),
  acreage: z.number().positive('Acreage must be more than 0.').max(100000).optional(),
  logoAssetId: z.number().int().positive().optional(),
  photoAssetId: z.number().int().positive().optional(),
}).superRefine((v, ctx) => {
  if (!normalizePhone(v.agent.phone)) ctx.addIssue({ code: 'custom', path: ['agent', 'phone'], message: 'Enter a valid US phone number for the agent.' });
  const m = applyMerge(v.message, { ownerName: v.to.name, propertyAddress: v.propertyAddress, acreage: v.acreage });
  if (m.unknown.length) ctx.addIssue({ code: 'custom', path: ['message'], message: `Unknown merge field {{${m.unknown[0]}}}. Use {{owner_name}}, {{property_address}} or {{acreage}}.` });
  else if (m.missing.length) ctx.addIssue({ code: 'custom', path: ['message'], message: `Your message uses {{${m.missing[0]}}} but that field is empty. Fill it in or remove it from the message.` });
  else if (m.text.length > messageMax(v.size)) ctx.addIssue({ code: 'custom', path: ['message'], message: `The back message is ${m.text.length} characters after merging; the ${v.size} card holds ${messageMax(v.size)}.` });
});
export type PostcardInput = z.infer<typeof postcardSchema>;

export interface Images { logo?: string; photo?: string }

/** Everything the card shows, built the same way for the preview and for the real send. */
export function buildSpec(input: PostcardInput, images: Images = {}): PostcardSpec {
  const merge = { ownerName: input.to.name, propertyAddress: input.propertyAddress, acreage: input.acreage };
  return {
    size: input.size as PostcardSize,
    design: input.design as DesignId,
    message: applyMerge(input.message, merge).text,
    agent: { name: input.agent.name, phone10: normalizePhone(input.agent.phone)!, brokerage: input.agent.brokerage },
    merge,
    logoDataUri: images.logo,
    photoDataUri: images.photo,
  };
}
export const buildPreview = (input: PostcardInput, images: Images = {}): Rendered => renderPostcard(buildSpec(input, images));

export type SendResult =
  | { ok: true; postcardId: number; lobId: string; chargedCents: number; balanceAfterCents: number }
  | { ok: false; code: 'insufficient_funds' | 'address_rejected' | 'not_set_up' | 'mail_failed' | 'busy'; message: string; postcardId?: number; balanceCents?: number; priceCents?: number };

export async function sendPostcard(deps: { pool: Pool; lob: LobClient }, userId: number, input: PostcardInput, images: Images = {}): Promise<SendResult> {
  const { pool, lob } = deps;
  // One send at a time per account (held on its own connection until we are done).
  const lock = await pool.connect();
  try {
    const got = (await lock.query('SELECT pg_try_advisory_lock(7001, $1) AS ok', [userId])).rows[0].ok;
    if (!got) return { ok: false, code: 'busy', message: 'Another postcard from your account is still being sent. Try again in a moment.' };
    try {
      return await run(pool, lob, userId, input, images);
    } finally {
      await lock.query('SELECT pg_advisory_unlock(7001, $1)', [userId]).catch(() => {});
    }
  } finally {
    lock.release();
  }
}

async function run(pool: Pool, lob: LobClient, userId: number, input: PostcardInput, images: Images): Promise<SendResult> {
  // 1. price for this size (from admin settings), return address, balance
  const item = postcardItem(input.size as PostcardSize);
  let price: number;
  let from;
  try {
    const p = (await getPrices(pool))[item];
    if (!p.enabled || !Number.isInteger(p.cents) || p.cents <= 0) throw new SettingsError('That postcard size is not available.');
    price = p.cents;
    from = await getReturnAddress(pool);
  } catch (e: any) {
    if (e instanceof SettingsError) return { ok: false, code: 'not_set_up', message: 'Postcards are not set up yet.' };
    throw e;
  }
  if (!from) return { ok: false, code: 'not_set_up', message: 'Postcards are not set up yet (no return address).' };
  const balance = await getAvailable(pool, userId);
  if (balance < price) return { ok: false, code: 'insufficient_funds', message: 'Not enough wallet balance for this postcard. Add funds first.', balanceCents: balance, priceCents: price };

  const to = input.to;
  const spec = buildSpec(input, images);
  const rendered = renderPostcard(spec);
  const record = { size: input.size, design: input.design, agent: { name: input.agent.name, brokerage: input.agent.brokerage }, propertyAddress: input.propertyAddress ?? null, acreage: input.acreage ?? null, hasLogo: !!images.logo, hasPhoto: !!images.photo };
  const row = (await pool.query(
    `INSERT INTO postcards (user_id, parcel_key, to_name, to_line1, to_line2, to_city, to_state, to_zip, message, status, size, design, mail_type, spec)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sending',$10,$11,'usps_first_class',$12::jsonb) RETURNING id`,
    [userId, input.parcelKey ?? null, to.name, to.line1, to.line2 || null, to.city, to.state, to.zip, spec.message, input.size, input.design, JSON.stringify(record)])).rows[0];
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

  // 3. set the price aside (not charged yet). A bad address above already stopped for free.
  const hold = await reserveForService(pool, { userId, item, quotedCents: price, ref: `postcard-${id}`, idempotencyKey: `postcard:${id}`, description: `${input.size} postcard to ${to.city}, ${to.state}` });
  if (!hold.ok) {
    const notSetUp = hold.reason !== 'insufficient';
    const msg = notSetUp ? 'Postcards are not set up yet.' : 'Your balance changed and is now too low for this postcard. Nothing was sent or charged.';
    await setStatus('failed', msg);
    return { ok: false, code: notSetUp ? 'not_set_up' : 'insufficient_funds', message: msg, postcardId: id, balanceCents: hold.availableCents, priceCents: price };
  }

  // 4. Lob creates the card (the postcard id is the idempotency key: a retry cannot mail a second card)
  let lobId: string;
  try {
    lobId = (await lob.createPostcard({
      to: verified.address,
      from: { name: from.name, line1: from.address_line1, line2: from.address_line2 || undefined, city: from.city, state: from.state, zip: from.zip },
      front: rendered.front, back: rendered.back, size: input.size as PostcardSize, description: `Land Oracle postcard ${id}`, idempotencyKey: `landoracle-postcard-${id}`,
    })).id;
  } catch (e: any) {
    const msg = e instanceof LobError && e.code === 'rejected' ? `The mailing service refused the card: ${e.message}` : 'The postcard could not be sent right now. You were not charged. Please try again.';
    await releaseHold(pool, hold.holdId, 'lob_failed').catch(() => {});
    await setStatus('failed', msg);
    return { ok: false, code: 'mail_failed', message: msg + (e instanceof LobError && e.code === 'rejected' ? ' You were not charged.' : ''), postcardId: id };
  }

  // 5. Lob accepted the card: the held money becomes the charge, at the price that was held
  let settled = await settleHold(pool, hold.holdId, { ref: lobId }).catch(() => null);
  if (!settled || !settled.ok) settled = await settleHold(pool, hold.holdId, { ref: lobId }).catch(() => null); // one retry
  if (!settled || !settled.ok) {
    // The card is already on its way, so it is not cancelled. The money stays held (never auto-expires) for a person to settle.
    console.error('[postcards] card sent but the charge did not complete: postcard', id, 'hold', hold.holdId);
    await inTx(pool, (c) => keepHold(c, hold.holdId, 'card sent, settle failed: needs attention')).catch(() => {});
    await setStatus('sent', 'Charge pending: needs attention.', { lobId, cost: price });
    return { ok: true, postcardId: id, lobId, chargedCents: price, balanceAfterCents: await getAvailable(pool, userId).catch(() => 0) };
  }
  await setStatus('sent', null, { lobId, cost: price, ledgerId: settled.ledgerId });
  return { ok: true, postcardId: id, lobId, chargedCents: price, balanceAfterCents: settled.balanceAfterCents };
}
