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

## County property-record links

`lib/ncCountyLinks.ts`, keyed by NC FIPS (`co_no`). Counties without an entry show the parcel ID as plain text.

- **Direct (12): the link opens that parcel's record (or its results list).** Each was tested in a real browser or by fetch on 3 or more real parcels, and the owner and address matched our data.
  - Spatialest record cards: Alamance 1 (alt_key), Orange 135 (parcel_id; decimal suffixes work), Pitt 147 (alt_key WITHOUT leading zeros, otherwise "not found"), Henderson 89 (alt_key), Union 179 (parcel_id: 8 digits with or without a one-letter suffix, about 98% of parcels).
  - Yancey 199 (parcel_id): the county assessor search is a GET form, so a search address redirects straight to the record.
  - Iredell 97 (parcel_id): opens the results list for the parcel (one row per tax year); click the newest year's "PRC" for the record card.
  - Wake 183 (alt_key = REID), Buncombe 21 (parcel_id), Durham 63 and Randolph 151 (alt_key = REID), Gaston 71 (alt_key; year segment 2026).
  - Builders return null (plain text) on an unusable ID shape.
- **Search page + copied ID (17):** the county's official lookup opens and the app copies the ID; the user pastes it. What to paste where (tested):
  - Guilford 81 and Forsyth 67 ("Real Property PWA", record pages need an internal number we lack): paste the 10-digit PIN (Guilford drops the "-000" suffix; Forsyth uses alt_key).
  - Yadkin 197: accept the disclaimer popup, paste alt_key into "Enter Parcel ID" (1 parcel checked).
  - Rowan 159: "Parcel ID" box (2 of 3 checked). New Hanover 129: agree to the disclaimer, paste alt_key into "Parcel ID" (3 of 3).
  - Brunswick 19: choose "Parcel Number", paste (3 of 3). Onslow 133: choose "Alternate Parcel ID#", paste into "Map Number" (3 of 3).
  - Cleveland 45: accept, search, and pick the "Parcel N" suggestion (a short ID is a prefix of others) (2 of 3; tax-bill lookup). Davidson 57: choose "PIN#", paste, press Submit (2 of 3; one PIN was not found). Cumberland 51: "Search By" = "Parcel Number" (1 of 3; tax-bill search, bills not a record card).
  - Anson 7, Mecklenburg 119, Cabarrus 25, Catawba 35, Robeson 155, Carteret 31, Harnett 85: official lookup pages (Anson added at the owner's request; the others have not had an ID paste tested).
- **Moore 125** (search, link supplied by the owner): its tax-bill portal could not take our ID, but the county ArcGIS viewer can: tick "I Agree" + OK, open "Parcel ID Query", paste the 12-digit parcel_id into "PIN is" and click Apply (checked on 1 parcel; Enter alone does not run it).
- **Vance 181** (search, link supplied by the owner, ArcGIS parcel viewer): click "I agree", paste our parcel_id as is (spaces included) into the map's search box and pick the "Tax Parcels" suggestion; the Info panel then shows PIN, owner and address plus a Tax Card link. Checked on 2 parcels (the owner and address matched on the first; the spaced ID showed up as a suggestion). The address `&find=` parameter does not run a search.
- **Not added: Warren** (the link sent, warrenil.devnetwedge.com, is Warren County, ILLINOIS; its "Pay Taxes" link goes to pay-warrencountyil.com). Warren County NC still needs a link.
- **Washington 187** (direct, link supplied by the owner, taxweb.washconc.org): its details page is `Details.aspx?pin=<our alt_key, e.g. 7716.00-29-1423>`; checked on 3 parcels (owner and address matched). The site is http only. About 83% of Washington parcels have that alt_key; the rest are placeholder ids and show as text.
- **Watauga 189** (search, iasWorld; the owner's message had Wayne's link by mistake, so the county page from the vendor research was used): click Agree on the disclaimer, then the Parcel ID search; paste the 13-digit county parcel id (our alt_key, our parcel_id without dashes) and press Enter. Checked on 3 parcels.
- **Wayne 191** (direct, link supplied by the owner, ITSNet): the "Parcel Number" search is a single box and its results page is a plain address: `ITSNet/SearchResults.aspx?field=parcel&parcel=<our 10-digit parcel_id>&order=Owner%20Name` (same pattern as Iredell). Checked on 3 parcels (owner and address matched; click "PRC" for the record card).
- **Wilkes 193** (search, link supplied by the owner, iasWorld at parcelinfo.wilkescounty.net): the form has no PIN box ("Parcel ID" is a 7-digit county number we do not have; "Alternate ID" did not take our PIN), and for at least two of three sample parcels the county's PIN differs from the PIN in our NC OneMap file in the last digits (3855-70-6074 vs our 3855-70-6047). So the owner's "LAST, FIRST" is copied (the site matches the START of the name; the full name with "ETAL" finds nothing). Paste into "Owner Name", press Enter, pick the row with the right address. Checked on 3 parcels.
- **Wilson 195** (direct, link supplied by the owner, DEVNET wEdge like Gaston): its record address (`/parcel/view/<id>/<year>`) needs an internal id that is not our PIN, but the quick-search address `/search/quick?q=<our PIN as is>` returns a one-row result for the parcel; click the number in the row for the record. Checked on 3 parcels (owner and address matched each time).
- **Burke 23** (search, link supplied by the owner, gis.burkenc.org): same style of county map viewer as Yadkin: click Accept on the disclaimer, paste the 10-digit PIN (our parcel_id) into "Enter PIN" and press Enter (checked on 1 parcel; the result shows REID = our alt_key).
- **Craven 49** (search, link supplied by the owner, https://www.bttaxpayerportal.com/ITSPublicCRRP): the real-property portal has NO parcel-number search; it only offers owner name or address (address is split into house number + street boxes). So the OWNER NAME is copied and pasted into "Property Owner Name", then Submit (Enter alone does not run it). Checked on 3 parcels: two companies and one person ("WARREN, DARRYL A & CATHERINE S") each returned the right parcel. Owner names in our data come from the NC OneMap file, so a recently changed owner may not match.
- **Johnston 101** (search, link supplied by the owner, https://www.bttaxpayerportal.com/itspublicjo): the "Parcel Number" option is seven small boxes that take the county's own parcel number, not our PIN (typing our 12 digits fills the boxes but finds nothing). Owner name works: paste it into "Property Owner Name", Submit. The results table has a "PIN ID#" column that equals our parcel_id, so pick the row with that PIN. Checked on 3 parcels. (The Register of Deeds recorder link, erec.johnstonnc.com, is a login page for deed records, not a property lookup.) Wayne (page not confirmed as the county's own).
- **Not yet researched:** the other counties (see the list in the app code: any county without an entry shows plain text).
- Wake's link uses the legacy `services.wake.gov/realestate` path because the newer TaxPortal was down during testing. Re-test it periodically.
- Tests: `npx tsx scripts/ai/test-nc-links.ts`.
