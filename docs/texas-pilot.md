# Texas pilot (admin-only, in progress)

Builds on `docs/texas-survey.md` (on branch `feat/data-layers`). Source: TxGIO StratMap 2025 Land Parcels, CC0, compiled from county appraisal districts. Credit line for the app: "Texas Geographic Information Office (TxGIO) StratMap, from county appraisal districts".

## What the county files contain (checked 2026-11-12, every row, not a sample)

The survey's open question was whether the downloadable files are richer than the web service it sampled. They are, and it differs by county.

| County | Rows | Prop ID | Owner | Land use (state class) | Land value | Improvement value | Market value | Year built | Site house number |
|---|---|---|---|---|---|---|---|---|---|
| Travis | 834,936 | 48.5% (see below) | 99% | 0% | 0% | 0% | 99% | 0% | 0% |
| Harris east | 536,512 | 100% | 100% | 100% | 95% | 2% | 95% | 84% | 90% |
| Harris west | 987,129 | 100% | 100% | 100% | 97% | 3% | 97% | 89% | 93% |
| Bexar | 709,541 | 100% | 98% | 88% (+ local code 98%) | 98% | 88% | 98% | 87% | 92% |

- **Land use exists for Harris and Bexar** (the web service showed none). Travis supplies none, so "vacant land" works only in counties that send a class code. The app must say "not available in this county" for the others.
- Texas state class codes: A single-family, B multifamily, C vacant lot / land tract, D rural land, E rural improvements, F commercial / industrial, and so on. We treat an account as likely vacant only when every class on it is C.
- **Travis has about 430,000 rows with Prop ID 0.** These are business personal property accounts ("F&F AND VEH ...") that reuse a parcel's shape. They are not land, so the loader skips them. About 24,000 real Travis parcels share a Prop ID with another row (split shapes) and are numbered `-D2`, as in NC.
- Travis site addresses carry the street name but no house number; the loader shows the street name only.
- Harris is two files (east and west) in one download; Prop IDs are 13 digits.
- All files are WGS84, so no reprojection is needed.

## Loader

- `scripts/data-layers/tx-profile.cjs`: field fill rates for one `.dbf` (read-only).
- `scripts/data-layers/load-tx-parcels.cjs <table> <county3> <shp[,shp]>`: loads one county (re-runnable) into `public.<table>`, shaped like `parcels_nc` (state 'TX', key `TX-<county3>-<propid>`).
- `scripts/data-layers/tx-load-all.cjs <table> <workdir> <keys.txt> [skip]`: downloads and loads every county one at a time, resumable, deletes each county's files after loading. Throttles itself when the live site's search slows down.

## Status

See the "Load results" section below (filled in as loads finish).


## County links (BIS eSearch)

`lib/txCountyLinks.ts` links a parcel to its appraisal district's record. First family: BIS Consultants "eSearch" sites,
`https://<host>/Property/View/<Prop_ID>` (our `parcel_id` is the Prop_ID, so nothing needs copying).

How the list was built (2026-11): for every Texas county, tried the usual `esearch.<county>cad.org/.com/.net` (and hyphen) hosts, kept
those whose page says "Powered by BIS Consultants" (105), then fetched `/Property/View/<id>` for 3 real parcels per county and
required HTTP 200 and the owner's name on the page. 90 counties passed and are linked. 15 did not and are NOT linked:
Borden, Bosque, Brazos, Callahan, Concho, Hartley, Johnson, Knox, McMullen, Mills, Oldham, Orange, Robertson, Terrell, Willacy
(Orange and Terrell show a different owner for the same id; Bosque, Callahan, Knox show no owner block; Johnson and Robertson had
no numeric ids to test; the rest matched only some samples).

Not covered yet: BIS counties on non-standard hosts (e.g. Fort Bend `esearch.fbcad.org`, Bell, Dallas), Cloudflare-blocked sites,
Bexar (True Automation), TrueProdigy and other vendors. Harris, Travis and the other big districts have their own sites.

### Second batch (2026-11)

Dallas CAD (113): `https://www.dallascad.org/AcctDetailRes.aspx?ID=<17-digit account>`; 10 random parcels all showed the owner
(the residential page also shows commercial accounts). BIS hosts on non-standard addresses, each 9-10 of 10 random parcels matched
the owner: Comal `esearch.comalad.org`, Brazos `esearch.brazoscad.org`, Guadalupe `esearch.guadalupead.org`, Jefferson `esearch.jcad.org`;
and a re-check with 10 random parcels (any owner word) passed Borden, McMullen, Willacy. Mills, Hartley, Concho, Oldham, Orange,
Terrell still fail and stay unlinked.

Still open (big counties, formats not yet confirmed): Harris (public.hcad.org returns a server error to automated requests), Tarrant,
Bexar, Travis, El Paso, Collin, Denton, Hidalgo, Montgomery, Williamson, Fort Bend (BIS host `esearch.fbcad.org` loads, but the page
shows no owner without scripts, so it cannot be verified the same way). Need one real parcel-detail URL from each site.

### Third batch (2026-11-13), links found by the owner and checked in a browser

- Travis (453): `https://travis.prodigycad.com/property-detail/<Prop_ID>` (TrueProdigy). 2 real parcels: owner and street matched.
- Bexar (29): `https://hgo.harrisgovern.com/bexar/property/<roll year>-<Prop_ID>` (Harris Govern portal; the bare id gives "Not Found").
  3 real parcels: owner matched. The roll year is `TX_ROLL_YEAR` in `lib/txCountyLinks.ts`; update it when a new roll opens.
- Not linkable yet: Harris (the map viewer has no known deep link; HCAD's own details page errors for scripts) and Tarrant
  (TAD's pages need an account number we do not have; our ids are the tax-parcel numbers like 47830-6-6).

### Harris and Tarrant (2026-11-13)

- Harris (201): search link. Opens the HCAD parcel viewer and copies the 13-digit account; the user pastes it into "Find address or place".
  Checked: the viewer suggests the parcel with the right street for a real account. Not a direct link (the viewer has no per-parcel address).
- Tarrant (439): `https://www.tad.org/property?account=<8-digit PID>`. Our ids are tax-parcel numbers, so `scripts/data-layers/tx-tarrant-pid.cjs`
  downloads the PID from TAD's public ArcGIS layer (`tad.newedgeservices.com/.../InteractiveMap/TADMap/MapServer/0`) into
  `public.tx_tarrant_pid` and fills `parcels_tx.alt_key` for county 439 (746,706 of 757,156 rows). Checked: ONECAT LLC's page opened with its PID.
