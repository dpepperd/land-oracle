// Money helpers. Everything is whole cents; floats never touch a balance.
export const MIN_TOPUP_CENTS = 2000;      // $20 minimum pack
export const MAX_TOPUP_CENTS = 100_000;   // $1,000 per top-up (a sanity cap, not a business rule)
export const BILLING_ENTITY = 'Fortune Oracle Media LLC';

export const formatUsd = (cents: number | bigint | string) => {
  const n = Number(cents);
  return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 100).toFixed(2)}`;
};

/** "20", "20.00", "$20.5" become cents; anything else (negative, 3+ decimals, text) becomes null. */
export function parseUsdToCents(input: string | number): number | null {
  const s = String(input).trim().replace(/^\$/, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
