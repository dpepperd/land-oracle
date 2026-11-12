// "Seller signals": filters built only from fields already on the roll (no new data, no owner demographics).
// Used by BOTH /api/parcels/search and /api/parcels/export so a CSV always matches what the user sees.
// Alias `p` = parcels_current_all.

/**
 * Absentee = the owner's mailing address does not look like the property:
 *   - the owner's state is not FL, OR the 5-digit zip codes differ, OR the house numbers differ.
 * A plain "address strings differ" test flags about 41% of Clay parcels (mostly formatting: "RD E" vs "E ... Rd");
 * this test flags about 33%. Needs both addresses on the roll, so parcels with no site address are never flagged.
 */
/** Absentee test for a given "home" state (the owner is out of state when own_state differs from it). */
export function absenteeSqlFor(homeState: string): string {
  const home = homeState.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); // letters only: this text goes into SQL
  return `(
  nullif(btrim(p.own_addr1), '') IS NOT NULL AND nullif(btrim(p.phy_addr1), '') IS NOT NULL AND (
    (p.own_state IS NOT NULL AND p.own_state <> '${home}')
    OR left(btrim(p.own_zipcd::text), 5) <> left(btrim(p.phy_zipcd::text), 5)
    OR (substring(btrim(p.own_addr1) from '^[0-9]+') IS NOT NULL AND substring(btrim(p.phy_addr1) from '^[0-9]+') IS NOT NULL
        AND substring(btrim(p.own_addr1) from '^[0-9]+') <> substring(btrim(p.phy_addr1) from '^[0-9]+'))
  )
)`;
}

/** Florida (the default state). Byte-for-byte the same text as before the helper existed. */
export const ABSENTEE_SQL = absenteeSqlFor('FL');

export interface SellerSignalFilters {
  absentee?: boolean;
  nonHomestead?: boolean;
  /** No qualified sale on record in the last N years (also matches parcels with no sale in the file). */
  noSaleYears?: number;
}

/** Appends WHERE conditions + bind values; returns the new next-parameter index. */
export function addSellerSignalConditions(f: SellerSignalFilters, conditions: string[], values: unknown[], valIdx: number): number {
  if (f.absentee) conditions.push(ABSENTEE_SQL);
  // homestead is NULL when the roll has no exemption data; only an actual homestead exemption excludes a parcel.
  if (f.nonHomestead) conditions.push(`COALESCE(p.homestead, false) = false`);
  if (f.noSaleYears && f.noSaleYears > 0) {
    conditions.push(`(p.sale1_date IS NULL OR p.sale1_date <= current_date - ($${valIdx}::float8 * interval '1 year'))`);
    values.push(f.noSaleYears);
    valIdx++;
  }
  return valIdx;
}
