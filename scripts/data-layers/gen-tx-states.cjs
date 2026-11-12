// One-off generator for lib/txStates.ts from a "Name|fips3" list (one per line, taken from the Texas survey table).
// Usage: node scripts/data-layers/gen-tx-states.cjs <list.txt>
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/).map((l) => { const [n, c] = l.split('|'); return [Number(c), n.trim()]; }).sort((a, b) => a[0] - b[0]);
const src = `// Texas (pilot): county list and helpers. Admin-only for now; NOT part of the shared state registry (lib/parcels/states),
// so Florida code paths cannot be affected. County codes are the 3-digit Texas FIPS codes (001, 003, ... 507) as loaded from TxGIO StratMap
// into public.parcels_tx. Donley County (129) has no file in the source and is not listed.

export const TX_CREDIT = 'Parcel data: Texas Geographic Information Office (TxGIO) StratMap, from county appraisal districts. Verify with the county appraisal district before you transact.';

/** [Texas FIPS county code, display name] */
export const TX_COUNTIES: readonly (readonly [number, string])[] = ${JSON.stringify(rows)};

const canon = (s: string) => s.toLowerCase().replace(/\\s+county$/, '').replace(/[^a-z]/g, '');
const BY_NAME = new Map(TX_COUNTIES.map(([code, name]) => [canon(name), code]));

/** Texas county code for a display name (case/spacing tolerant), or null. */
export function txCountyCode(name: string): number | null {
  return BY_NAME.get(canon(name)) ?? null;
}
export function txCountyName(code: number): string | null {
  const hit = TX_COUNTIES.find(([c]) => c === code);
  return hit ? hit[1] : null;
}
export const TX_COUNTY_NAMES: string[] = TX_COUNTIES.map(([, n]) => n);
`;
fs.writeFileSync('lib/txStates.ts', src);
console.log('wrote lib/txStates.ts with', rows.length, 'counties');
