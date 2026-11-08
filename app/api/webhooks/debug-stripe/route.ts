// TEMPORARY diagnostic - delete after use. Never returns the key itself.
import Stripe from 'stripe';
export const dynamic = 'force-dynamic';

export async function GET() {
  const raw = process.env.STRIPE_SECRET_KEY ?? '';
  const info = {
    present: raw.length > 0,
    length: raw.length,
    prefix: raw.slice(0, 7),
    hasWhitespace: /\s/.test(raw),
    trimmedLengthDiffers: raw.trim().length !== raw.length,
    nonAscii: /[^\x21-\x7e]/.test(raw),
    lastCharCode: raw.length ? raw.charCodeAt(raw.length - 1) : null,
  };
  let result: unknown;
  try {
    const s = new Stripe(raw.trim(), { maxNetworkRetries: 0 });
    const c = await s.coupons.retrieve('FOUNDING40');
    result = { ok: true, coupon: c.id, valid: c.valid };
  } catch (e: any) {
    result = { ok: false, type: e?.type, code: e?.code, message: e?.message, cause: String(e?.detail ?? e?.raw?.message ?? e?.cause ?? '') };
  }
  return Response.json({ info, result });
}
