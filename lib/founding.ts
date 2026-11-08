// Founding-member coupon availability, read from Stripe and cached for 10 minutes. Hidden on any error or when exhausted.
import { stripe } from './stripe';
import { FOUNDING } from './plans';

export interface FoundingStatus { available: boolean; remaining: number | null }
const TTL_OK = 10 * 60_000, TTL_FAIL = 60_000;
let cache: { at: number; ttl: number; v: FoundingStatus } | null = null;

export async function getFoundingStatus(): Promise<FoundingStatus> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.v;
  let v: FoundingStatus = { available: false, remaining: null }, ttl = TTL_FAIL;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const c = await stripe.coupons.retrieve(FOUNDING.code);
      const max = c.max_redemptions ?? null;
      const remaining = max === null ? null : Math.max(0, max - (c.times_redeemed ?? 0));
      v = { available: c.valid && (remaining === null || remaining > 0), remaining };
      ttl = TTL_OK;
    } catch (e: any) {
      if (e?.code === 'resource_missing') ttl = TTL_OK;   // coupon not created yet: hide the banner
      else console.error('[founding] stripe lookup failed:', e?.message);
    }
  }
  cache = { at: Date.now(), ttl, v };
  return v;
}
