// Single source of truth for plans. Prices here are DISPLAY values for the pricing page; Stripe is billed via lookup_keys
// (scripts/stripe/setup-products.js creates the same amounts). Change both together.
export type PlanId = 'scout' | 'pro' | 'statewide';
export type Interval = 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;          // USD
  annual: number;           // USD (2 months free)
  counties: number | 'all'; // included counties
  exportsPerMonth: number | 'unlimited';
  ai: boolean;
  addonAllowed: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  scout:     { id: 'scout',     name: 'Scout',     monthly: 79,  annual: 790,  counties: 1,     exportsPerMonth: 1000,        ai: false, addonAllowed: true },
  pro:       { id: 'pro',       name: 'Pro',       monthly: 199, annual: 1990, counties: 3,     exportsPerMonth: 'unlimited', ai: true,  addonAllowed: true },
  statewide: { id: 'statewide', name: 'Statewide', monthly: 449, annual: 4490, counties: 'all', exportsPerMonth: 'unlimited', ai: true,  addonAllowed: false },
};
export const ADDON = { monthly: 39, annual: 390 };
export const FLORIDA_COUNTY_COUNT = 67;
export const FOUNDING = { code: 'FOUNDING40', percentOff: 40, maxRedemptions: 20 };

/** Stripe price lookup keys, e.g. scout_monthly, addon_county_annual. */
export const lookupKey = (plan: PlanId | 'addon_county', interval: Interval) => `${plan}_${interval === 'month' ? 'monthly' : 'annual'}`;

export const isPlanId = (v: unknown): v is PlanId => v === 'scout' || v === 'pro' || v === 'statewide';

/** Counties a subscriber may select: base + add-ons (statewide: all). */
export function countyAllowance(plan: PlanId, addonQty = 0): number {
  const p = PLANS[plan];
  if (p.counties === 'all') return FLORIDA_COUNTY_COUNT;
  return p.counties + (p.addonAllowed ? Math.max(0, addonQty) : 0);
}

export const annualPerMonth = (annual: number) => Math.round(annual / 12);

/** AI assistant is shown as "Coming soon" until AI_ASSISTANT_ENABLED=true (server-side flag). */
export const aiEnabled = () => process.env.AI_ASSISTANT_ENABLED === 'true';
