# North Carolina pilot (admin-only backend), 2026-11-12

Status: backend built and tested; NOT visible to customers or in any screen yet. Only admins can run a North Carolina search. No Florida code path was changed except one added line that hands `state: "NC"` requests to the NC code.

## How it is wired
- Data: `public.parcels_nc` (5,891,080 parcels, about 5.9 GB; loaded from NC OneMap, see docs/nc-onemap-terms-2026-11-11.md) and view `public.parcels_nc_current`, which exposes the same column names Florida's search uses. SELECT is granted to `landoracle_prod`.
- Code: `lib/ncSearch.ts` (the search), `lib/ncStates.ts` (100 counties by NC FIPS code, helpers, the NC OneMap credit text). NC is deliberately NOT in the shared state registry (`lib/parcels/states`), so the AI Analyst, flood lookup and Florida routes cannot see or be affected by it.
- Dispatch: `app/api/parcels/search/route.ts` calls `searchNc()` when `body.state === 'NC'`. `lib/validation.ts` accepts `state` ('FL' | 'NC') and `vacantOnly`.
- Gate: non-admins get 403 `state_not_available`.
- Export: `app/api/parcels/export/route.ts` refuses any request with a state other than FL (400 `state_export_not_available`) so a NC search can never produce a Florida CSV. NC CSV export is not built yet.
- Counties are matched by NC FIPS code (`co_no`), so county names that exist in both states (Clay, Washington, Jefferson, Union, Lee, ...) cannot cross over.
- Absentee: `absenteeSqlFor(homeState)` in `lib/sellerSignals.ts`; Florida's text is byte-for-byte unchanged. (The old text hardcoded 'FL', which would have flagged every NC owner as absentee.)

## Filters supported for NC
County, drawn area (polygon or circle), bounding box, acreage, value, owner in/out of state, absentee, "no sale in N years" (sale DATE only, on about 38% of parcels), likely-vacant (`vacantOnly`), parcel ID and address (county required). Not offered: land-use code list (NC codes differ), homestead, sale price, distance to highway.

## Data fixes applied to parcels_nc (scripts in scripts/data-layers)
1. Duplicate parcel keys: exact copies deleted, other records suffixed -D2, -D3 (`nc-dedupe-keys.cjs`; 5,891,080 rows, all keys unique).
2. Missing acreage: 576,705 parcels (11 counties had none: Clay, Orange, Buncombe, Cleveland, Robeson, Warren, Bladen, Chowan, Hoke, Alleghany, Edgecombe, plus scattered others) filled from the parcel outline (geodesic area / 4046.8564), `acreage_source = 'shape'` (`nc-fill-acreage.cjs`). Rows with the state's own acreage keep it (`acreage_source` NULL).
3. Owner location: in Wake, Onslow, Haywood, Chatham and others the owner's state and ZIP were not in separate fields, so the out-of-state filter silently treated those owners as in-state. Pass 1 split "CITY ST ZIP" out of `own_city` (422,914 rows; `nc-parse-owner-city.cjs`). Pass 2 read state and ZIP from the end of one-line mailing addresses (140,656 rows; `nc-parse-owner-address.cjs`; "CT" accepted only with a comma before it because it is also a street suffix). Parsed rows have `owner_loc_parsed = true`. Result: owners with no state fell from 837,398 (14%) to 273,828 (4.6%); out-of-state owners found: 544,544.
4. Still unknown: 273,828 parcels (4.6%) have no owner state or city (all of Onslow and Duplin, Hoke, Alleghany, parts of others: the county gave a street only). The out-of-state filter cannot see those owners. Show this limit in the UI before NC opens to customers.

## Known data limits to show customers
- Land-use code on only about 53% of parcels; "likely vacant" is a stand-in (about 96% precision against Dare County's own vacant labels).
- Sale date on about 38% of parcels, no sale price anywhere.
- Hoke has no owner, mailing or value data; Alleghany and Chowan have no values; Washington is about 82% complete.
- NC OneMap says data is as supplied by counties; cite NC OneMap (text in `NC_CREDIT`).

## Tests (real handlers, stubbed sign-in, dev database)
`scripts/ai/test-nc-search.ts` (29 checks: NC path, admin gate, Florida regressions for Clay/Washington/Jefferson, absentee state-awareness, owner-state parsing, drawn areas, text search, export guard). Also re-run test-area-flow, test-tier-export and test-ai-export after any change to the search or export routes.

## Screens (branch feat/nc-screens, admin-only)
- State picker (Florida | North Carolina) at the top of the sidebar, shown only when the signed-in user is an admin. Switching state clears filters, the drawn area and its outline, results and popups, and flies the map to the state.
- In NC: the 100 NC counties (never locked), "Likely vacant land" checkbox instead of the Florida land-use list, no homestead and no highway-distance filters, preset becomes absentee + out-of-state + likely vacant. A blue banner and the sidebar notes state the pilot and its data limits; the NC OneMap credit shows on the banner and in each popup.
- Cards show "<County> County, NC", a Likely vacant badge, and no "No sale on record" badge (NC has a sale date on only 38% of parcels). Popup shows land-use description, acreage "(from map shape)" when derived, last sale DATE (no price), N/A for missing values.
- The Florida county-appraiser link is never used for NC parcels (Clay, Washington, ... exist in both states).
- CSV export in NC shows "not available yet" (and the server refuses it).
- Request building lives in lib/searchState.ts; Florida requests are byte-for-byte what they were (no state field).
- Tests: scripts/ai/test-search-state.ts (12 pure checks), scripts/ai/test-ui-smoke.tsx (19 server-render checks of the sidebar, cards and list in NC and FL), plus the API suites. The map popup cannot be rendered outside a browser; it is covered by type checks and diff review only.

## Still to build (each as its own small, tested step)
NC county property-record links (feat/nc-county-links), NC CSV export, AI Analyst awareness, then an admin-only preview test with Tat; plans and pricing across states come after that. Flood tags already work for NC cards (live FEMA lookup works anywhere).
