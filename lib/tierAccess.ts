// Which plans the dashboard treats as "paid" (export button, contact fields, etc.). Single source of truth so a new plan can't be forgotten.
// Legacy names (demo, trial, local, regional) are treated as free, matching lib/entitlements.ts.
const PAID_TIERS = new Set(['scout', 'pro', 'statewide', 'enterprise']);

export type UiTier = 'demo' | 'paid';

export function uiTier(role: string | null | undefined, tier: string | null | undefined): UiTier {
  return role === 'admin' || (!!tier && PAID_TIERS.has(tier)) ? 'paid' : 'demo';
}
