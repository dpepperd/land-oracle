# Data layers (source, license, date, refresh plan)

Rule: every layer gets source, license/terms check, data date and a refresh plan here. A feature is listed on the pricing/overview page only once it works.
Last updated 2026-11-11.

## Florida parcels (live)
- Source: Florida DOR NAL/SDF rolls plus county parcel GIS (loaded as `parcels_v2`, exposed through views `parcels_current`, `parcels_current_nogeom`, `parcels_current_all`).
- Terms: none stated on the DOR data portal page. Research/verification disclaimer in the app.
- Data date: 2026 roll. Refresh: yearly with the new roll (reload per county; see docs/post-launch-plan.md).
- Removed 2026-11-11: legacy `parcels` table (21 GB). Nothing read it (no views, keys or triggers). No separate backup was taken; DO managed backups are the only fallback.

## Flood hazard zones: FEMA NFHL (live, rebuilt 2026-11-11)
- Source: FEMA National Flood Hazard Layer, layer 28 (S_FLD_HAZ_AR), read from https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28. Same data as FEMA's state download NFHL_12_20260409.zip (2.7 GB).
- License: FEMA data is U.S. government public data. Present as a research aid, never a flood determination.
- Loaded: 594,084 of FEMA's 594,090 polygons. 62 of 67 counties match FEMA exactly; 5 counties are short by 1-2 shapes that FEMA's server would not send (Citrus, DeSoto, Gilchrist, Jefferson, Pinellas). 0 empty or invalid shapes.
- Storage: table `public.flood_nfhl`, one geometry column, shapes simplified to about 2 m (ST_SimplifyPreserveTopology 0.00002 deg): 841 MB (the old table was 11 GB). Compatibility views `public.flood_hazard` (same columns as the old table, geom_safe = geom) and `public.v_flood_hazard_map` keep the map, AI and flood filter working with no code change. SELECT granted to landoracle_prod.
- Why rebuilt: the old table matched FEMA in only 8 of 67 counties (Miami-Dade 34 shapes vs 3,637; Duval 350 vs 10,207; duplicates elsewhere).
- Verification: 21 of 21 random parcels in Clay, Duval and Monroe matched FEMA live; the old table matched 0 of 21. Live map spot checks: Miami Beach AE/AH/VE, Key West VE/AE.
- Loader: `scripts/data-layers/load-nfhl.cjs <table> <fips,...>` (adaptive page size, skips bad records, resumes by skipping counties that already match FEMA's count).
- Also live: flood tag on result cards and map popup via live FEMA lookup (`lib/fema.ts`, `/api/parcels/flood`), 24 h memory cache, falls back to our table.
- Refresh plan: FEMA updates continuously. Reload yearly (or when a customer reports a stale map) by running the loader into a new table and swapping.
- TODO (Phase 1): per-parcel side table (`flood_zone` dominant, `pct_in_sfha`), keyed by parcel, only parcels that touch a flood polygon; run county by county in gentle mode.

## Wetlands: USFWS NWI (Phase 2, not started)
- Plan: vector tiles (PMTiles) in a dedicated R2 bucket (not Postgres); per-parcel `wetland_acres`, `wetland_pct`, `upland_acres` in a side table.

## Road access / landlocked (Phase 3, not started)
- Plan: FDOT plus Census TIGER road centerlines; per-parcel `has_road_frontage`, `frontage_ft`, `nearest_road_dist_ft`; separate "access via same owner" flag; manual check of 20 rural Clay/Putnam parcels.

## Zoning / future land use (Phase 4, not started)
- Pilot counties: Clay, Duval, St. Johns, Nassau, Putnam. No known free statewide zoning layer for Florida (to confirm in the first step).

## Tax delinquent (Phase 5, research only)
- Not started.

## North Carolina (loaded into staging table nc_parcels_stage; not in the app; admin-only pilot planned)
- Source: NC OneMap statewide parcels, https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer (layer 0 points, layer 1 polygons), 5,925,955 parcels, 100 counties, max 5,000 per request.
- License: see docs/nc-onemap-terms-2026-11-11.md ("free and unrestricted use"; no written agreements issued; sales must not violate NC law; cite NC OneMap).
- Fields: owner, mailing street/city/state/zip, site address, land/improvement/total value, acres, sale DATE (no price), land-use code and description, year built, owner type.
- Completeness (all 100 counties, read-only scan 2026-11-11): owner >=90% in 98 counties (99% of parcels); mailing >=90% in 96; value >=90% in 91; site address >=90% in 77; land use >=90% in only 39 counties (about 51% of parcels; zero in Guilford, Forsyth, Cumberland); sale date >=90% in 30 counties (about 43%). Hoke has no owner/mailing/value; Washington about 82%; Clay (NC) has owners but no mailing addresses.
- Quirks: mailing street sometimes has the zip appended; some counties have no land-use code.
- Plan: "likely vacant" stand-in where land use is blank (land value > 0, improvement value 0, no structure year), labelled; hide sale-price and homestead filters for NC; show "not available in this county" where a field is blank.
- Estimated size: 4-5 GB. Estimated build: 8-10 working days, 2-3 weeks calendar.
- Decisions made: pilot is ADMIN-ONLY first; plans and pricing across states decided later. County access must store state plus county (county names repeat across states, e.g. Clay).
- Order: finish the Florida flood table first, then NC.
- LOADED 2026-11-11/12: loader scripts/data-layers/load-nc-parcels.cjs (county by county, resumable, gentle mode). All 100 counties; 5,938,804 parcels = exactly the state's total; 0 empty or invalid shapes; coordinates inside NC. Two counties (Clay 043, Alleghany 005) first loaded zero because the state labels their code unpadded ('43', '5'); the loader now matches both.
- Size: about 5.8 GB for the whole state (about 1 KB per parcel), less than the 4-5 GB-per-million estimate. Database total about 21 GB of 80 GiB.
- Quality (whole state): owner name 98.9%, mailing street 98.4%, out-of-state owners 503,115, land-use code on 53% of parcels, sale date on 38%, year built on 46%; 'likely vacant' stand-in flags 1.3M parcels (96% precision against the counties' own vacant-land labels in Dare County).
- Duplicate parcel numbers (found 2026-11-12): 52,828 parcel numbers appeared on more than one row (89,320 extra rows, 1.5%), concentrated in Chowan (almost every parcel doubled), Mecklenburg, Henderson, Cabarrus. Causes: exact copies in the state's data (56% of groups), distinct records sharing a parcel number (e.g. a manufactured home and the land under it, different owners/values), and placeholder numbers ('0' 474 rows, 'ROW' 284 rows). Cleanup (scripts/data-layers/nc-dedupe-keys.cjs, one transaction): delete exact copies (47,724 rows, keeping the lowest gid), then give the other records a stable suffix -D2, -D3 (ordered by owner, use code, value desc, gid; the first keeps the plain key) (41,596 rows). Result: 5,891,080 rows, all parcel_keys unique. Re-run this script after any reload of NC.
- Still to do: add NC to the search view with state + county access (county names repeat across states), state picker, hide unsupported filters, show the NC OneMap credit, AI tools aware of state, and an admin-only preview test. VACUUM the staging table after the dedupe.
