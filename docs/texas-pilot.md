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
