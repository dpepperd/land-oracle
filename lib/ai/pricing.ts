// $ per 1M tokens (Anthropic first-party list prices, checked against the claude-api skill model table 2026-10-06).
// Override with AI_PRICE_INPUT / AI_PRICE_OUTPUT (and AI_PRICE_CACHE_READ) if the table is stale.
export interface Price { input: number; output: number; cacheRead: number; cacheWrite: number }
const T: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
};
export function priceFor(model: string): Price | null {
  const base = T[model] ?? null;
  const i = Number(process.env.AI_PRICE_INPUT), o = Number(process.env.AI_PRICE_OUTPUT);
  if (i > 0 && o > 0) return { input: i, output: o, cacheRead: Number(process.env.AI_PRICE_CACHE_READ) || (base?.cacheRead ?? i * 0.1), cacheWrite: base?.cacheWrite ?? i * 1.25 };
  return base;
}
export interface Totals { input: number; cacheWrite: number; cacheRead: number; output: number; requests: number }
export const emptyTotals = (): Totals => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, requests: 0 });
export function costUsd(model: string, t: Totals): number | null {
  const p = priceFor(model);
  if (!p) return null;
  return (t.input * p.input + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead + t.output * p.output) / 1e6;
}
