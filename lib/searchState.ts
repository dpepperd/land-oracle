// Which state the dashboard is searching, and how the search request is built for it.
// IMPORTANT: for Florida (the live product) the request must stay exactly what it was before North Carolina existed:
// no `state` field, nothing new. Only North Carolina requests carry the extra fields.
import { withArea, type SearchArea } from '@/lib/searchArea';

export type SearchState = 'FL' | 'NC' | 'TX';

/** True for the admin-only pilot states (everything except Florida). */
export const isPilotState = (s: SearchState | string | null | undefined): s is 'NC' | 'TX' => s === 'NC' || s === 'TX';

/** Where the map should look when the state changes: [longitude, latitude, zoom]. */
export const STATE_VIEW: Record<SearchState, [number, number, number]> = {
  FL: [-82.2, 28.0, 6],
  NC: [-79.4, 35.5, 6.5],
  TX: [-99.3, 31.2, 5.2],
};

/** Filters the pilot-state (NC, TX) searches does not use (they are Florida land-use codes, homestead data, FDOT highways). */
const NC_UNSUPPORTED = ['landUse', 'nonHomestead', 'maxDistance'] as const;

/** The JSON body sent to /api/parcels/search for the current state, sidebar filters and drawn area. */
export function buildSearchBody<T extends Record<string, any>>(filters: T, area: SearchArea | null, state: SearchState): Record<string, any> {
  const body: Record<string, any> = withArea(filters, area);
  if (!isPilotState(state)) return body; // Florida: unchanged
  for (const k of NC_UNSUPPORTED) delete body[k];
  body.state = state;
  return body;
}

/** Filters to start from after the user switches state (everything state-specific cleared, limit kept). */
export function freshFilters(limit = 1000) {
  return {
    counties: [] as string[], landUse: [] as string[], acreageMin: undefined, acreageMax: undefined, marketValueMin: undefined, marketValueMax: undefined,
    maxDistance: 0, ownerType: 'all', parcelId: '', address: '', absentee: undefined, nonHomestead: undefined, noSaleYears: undefined, vacantOnly: undefined, limit,
  };
}

/** Plain-language limits of each state's data, shown in the screen. */
export const STATE_NOTES: Record<SearchState, string[]> = {
  FL: [],
  NC: [
    'North Carolina is an admin-only pilot. Data: NC OneMap, as supplied by the counties.',
    'No sale prices or homestead data. Land use is missing for about half of parcels, so "likely vacant" is an estimate.',
    'Owner location is missing for about 5% of parcels (all of Onslow and Duplin), so out-of-state search cannot see those owners.',
  ],
  TX: [
    'Texas is an admin-only pilot. Data: Texas Geographic Information Office (StratMap 2025), as supplied by the appraisal districts.',
    'No sale dates or prices, and no homestead data. Land use is the Texas state class (A home, C vacant lot, D rural land, F commercial); about half of parcels have one, and Travis County has none, so "likely vacant" is an estimate.',
    'Some counties supply no market values. Acreage is missing for about 5% of parcels. Owner mailing state is present for about 98%.',
  ],
};
