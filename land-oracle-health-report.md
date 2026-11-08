# Land Oracle — Health Audit (read-only)

Audit date: 2026-11-06. Database: PostgreSQL 17.11 + PostGIS 3.5.0 (DigitalOcean managed, `defaultdb`, 32 GB).
Method: SELECT-only queries over a session forced to `default_transaction_read_only=on`, plus file reads and `npm run build`. Nothing in the DB or repo was modified except this report (the build rewrote `.next/` as a normal build does). Env var **names** only; no values printed.

> **Premise correction:** the DB does not hold 9 North Florida counties / ~888K parcels. It holds **all 67 Florida counties / 10,938,053 parcels**. If 888K came from somewhere, it is stale or about a different dataset.

---

## 1. Schema inventory

| Relation | Kind | Rows (est.) | Total size |
|---|---|---|---|
| `parcels` | table | 10,938,053 (exact) | 21 GB (11 GB heap) |
| `flood_hazard` | table | 572,371 (exact) | 11 GB |
| `traffic_stats` | table | 21,378 (all year 2024) | 12 MB |
| `spatial_ref_sys` | table | 8,500 | 7 MB |
| `highways` | table | 745 | 3 MB |
| `us_roads` | table | 663 | 1 MB |
| `interstates` | table | 82 | 240 kB |
| `users` / `user_county_access` / `user_usage_exports` / `user_usage_searches` | app tables | 2 / 5 / small / 0 | <50 kB each |
| `user_parcel_notes`, `leads`, `demo_sessions`, `fema_flood_zone_cache`, `fema_bfe_cache` | app/cache | **0 rows** | empty |
| `storyboard.projects` / `storyboard.scenes` | table | 1 / 1 | unrelated to parcels (video storyboard) |
| `v_flood_hazard_map` | view | n/a | — |

`pg_stat_user_tables` shows `n_live_tup = 0` and no `last_analyze` for `parcels`/`flood_hazard`, so planner stats may be stale or missing (looks like a restore or stats reset). Not fixed here (`ANALYZE` is a write).

### `parcels` columns (131)

**Source = DOR NAL CSV (≈120 cols)**, stored under shapefile-style 10-char truncated names:
`co_no, parcel_id, file_t, asmnt_yr, bas_strt, atv_strt, grp_no, dor_uc, pa_uc, spass_cd, jv, jv_chng, jv_chng_cd, av_sd, av_nsd, tv_sd, tv_nsd, jv_hmstd … av_wrkng_w, nconst_val, del_val, par_splt, distr_cd, distr_yr, lnd_val, lnd_unts_c, no_lnd_unt, lnd_sqfoot, dt_last_in, imp_qual, const_clas, eff_yr_blt, act_yr_blt, tot_lvg_ar, no_buldng, no_res_unt, spec_feat_, m_par_sal1/2, qual_cd1/2, vi_cd1/2, sale_prc1/2, sale_yr1/2, sale_mo1/2, or_book1/2, or_page1/2, clerk_no1/2, s_chng_cd1/2, own_name, own_addr1/2, own_city, own_state, own_zipcd, own_state_, fidu_*, s_legal, app_stat, co_app_sta, mkt_ar, nbrhd_cd, public_lnd, tax_auth_c, twn, rng, sec, census_bk, phy_addr1/2, phy_city, phy_zipcd, alt_key, ass_trnsfr, prev_hmstd, ass_dif_tr, cono_prv_h, parcel_id_, yr_val_trn, seq_no, rs_id, mp_id, state_par_, spc_cir_cd/yr/tx`

**Source = county parcel shapefile:** `gid` (PK, serial), `parcelno` (shapefile PARCELNO, this is the key the app actually uses), `oid_` (shapefile OBJECTID), `geom`.

**Computed by our load scripts (not in either source):** `county` (from folder name), `acreage` (from geometry), `latitude`, `longitude`, `geojson` (text copy of geometry, ~10 GB of the table), `out_of_state` (derived from owner state), `distance_to_highway` (only 12,814 rows populated).

**Manual-entry / CRM placeholders:** `phone_number`, `phone_verified`, `email`, `email_verified`. **All 0 populated**, so nothing manually entered lives in `parcels`.

Manual user data lives in separate tables (`user_parcel_notes`, `leads`, `users`, `user_county_access`), keyed on `parcelno` strings (see `app/api/parcels/search/route.ts:200-203`). `user_parcel_notes` and `leads` are empty today.

### Indexes / constraints on `parcels`
PK `gid`; **UNIQUE (county, parcel_id)**; GIST `parcels_geom_idx`; btree on `county`, `(county,jv)`, `jv`, `acreage`, `alt_key`. **No index on `parcelno`**, even though the app searches and joins on it (`parcelno ILIKE`, `leads` join, notes join).

---

## 2. Coverage

All 67 counties present. Top/bottom: Miami-Dade 936,467 · Broward 764,726 · Palm Beach 658,030 · Lee 559,124 · Hillsborough 527,834 … Lafayette 7,233 · Union 6,960 · Liberty 5,885. Full per-county counts are in the DB (`select county,count(*) from parcels group by 1`).

I compared each DB county against its DOR NAL CSV on `D:\LandOracle\Florida\<County>` (normalized parcel-ID match, i.e. uppercase, strip punctuation, strip leading zeros):

- NAL rows on disk: 10,860,642 across 65 counties. **Walton and Washington have no NAL CSV on disk** (only `gis/`), yet their DB rows have full owner/JV/situs data, so those were loaded from somewhere not in this folder.
- **Excluding Pasco, ~117,943 NAL parcels (1.12%) are missing from the DB.** Counties materially incomplete:

| County | NAL parcels missing from DB | % |
|---|---|---|
| Suwannee | 7,100 / 38,852 | 18.3% |
| Calhoun | 1,734 / 13,237 | 13.1% |
| Santa Rosa | 11,988 / 120,500 | 9.9% |
| Saint Johns | 15,758 / 166,712 | 9.5% |
| Gulf | 1,270 / 19,958 | 6.4% |
| Escambia | 10,250 / 170,564 | 6.0% |
| Gilchrist / Taylor | 809 / 14,723 · 1,025 / 19,726 | 5.5% / 5.2% |
| Hardee, Jefferson, Lafayette, Citrus, Madison, Nassau, Baker, Liberty, Hamilton | | 3.0–4.0% |
| Franklin, Okaloosa, Manatee, Flagler, Gadsden | | 2.1–2.8% |

- **Pasco:** `parcel_id` doesn't match NAL (see §3), so this method can't measure it. By row count NAL has 328,322 vs DB 314,425, about 4% short.
- Several counties have *more* DB rows than NAL (Broward +10k, Brevard +1k, Hillsborough +3.6k). Likely shapefile-only parcels (no tax roll record) or condo/split geometry. Not investigated.
- `scripts` earlier produced `audit_results.txt`/`audit-gaps.txt` (Feb/Apr 2026); those reported larger gaps (Collier 20%, Leon 22%, St Johns 28%). Collier and Leon now show ~1–1.4% missing, so those repairs worked. St Johns is still the largest absolute gap.

### Tax year / roll date
- **There is effectively no vintage field in the DB.** `asmnt_yr` and `co_no` are **NULL for every row except Baker** (12,663 rows = 2025; 168 = 0). `dt_last_in` is also only Baker.
- The source files are all **2025 rolls** (NAL `ASMNT_YR` = 2025 in every county CSV except Volusia, which has none). File suffixes show mixed roll stages: `…F202501` (Preliminary roll), `…F202502`, and `…VAB` (post-VAB) variants, i.e. not one uniform snapshot date.
- No import-date / loaded-at column exists. Only the git history and file mtimes show when counties were loaded.
- `traffic_stats.year` = 2024 for all rows. `flood_hazard` has no date; its `source_name` is `DUVAL` for all 67 counties (looks like a mislabel).

---

## 3. Data quality

Statewide blank/null rates (10,938,053 rows):

| Field | Blank/NULL | % |
|---|---|---|
| parcel_id | 503,324 | 4.6% (Clay 100%, Duval 100%, Baker 1.3%) |
| parcelno | 953,221 | 8.7% |
| owner name | 391,738 | 3.6% (**Volusia 100%**) |
| mailing addr (own_addr1) | 788,876 | 7.2% (**Sumter 100%, Charlotte 95.7%, Santa Rosa 68.3%**) |
| situs addr (phy_addr1) | 8,654,672 | **79.1%** |
| land use (dor_uc) | 73,747 | 0.7% |
| just value (jv) | 99,406 NULL + 207,587 zero | **Sumter 100% NULL**; zeros 1.9% |
| acreage | 99,423 NULL + 54,954 zero | Sumter 100% NULL |
| last sale price / year | 10,925,222 NULL | **99.88%**: populated only for Baker |
| geometry | 17 NULL | ~0% (all Baker) |

**Per-county highlights** (the ones that matter):
- **Situs address is 100% blank in 40 counties (≥98% in 43)** (including Miami-Dade, Broward, Palm Beach, Orange, Hillsborough, Lee, Pinellas, Polk, Brevard, Collier, Leon, Marion …) even though NAL has `PHY_ADDR1` at 80–100% for them. This is a load omission, not source-blank.
- **Sale data is lost statewide.** NAL has `SALE_PRC1` populated for ~9–21% of parcels in every county, and the DB has none outside Baker. **"Last sale date/price" is not usable.** (Volusia's NAL shows 96% because it's a generated file, see below.)
- **Many other NAL fields are empty statewide** (1% sample, n=111,036): `s_legal`, `twn`, `nbrhd_cd`, `lnd_val`, `tot_lvg_ar`, `act_yr_blt`, `sale_prc2`, `dt_last_in` are each populated in only ~133 rows (Baker), `or_book1` 0. `own_zipcd` is populated in 37%, `phy_zipcd` 8%, `phy_city` 10%. So effectively **only ~20 of ~120 NAL columns were actually loaded** (identity, DOR use code, JV, owner/mailing name+address, partial situs).
- **Exemption fields `EXMPT_01…EXMPT_82` were never loaded** (no columns exist).
- **Sumter:** JV, acreage, mailing address are 100% NULL; 164 geometries have no attributes. NAL source (101,146 rows) has JV 100% populated, so it's a load failure.
- **Volusia:** owner name and mailing address 100% blank. The source on disk is `NAL_Volusia_Generated.csv` (no `ASMNT_YR`, owner empty), i.e. not an official DOR NAL. There is a `Parcel_Ownership.zip` in the folder that was apparently not used.
- **Charlotte** mailing 95.7% blank and **Santa Rosa** 68.3% blank (NAL has `OWN_ADDR1` at 4% and 34% for those, so partly a source limitation).

### Duplicates
- `(county, parcel_id)`: **0 duplicates** (enforced by unique index). Caveat: Postgres allows many NULLs in a unique index, so the 503K rows with NULL `parcel_id` are not covered.
- Normalized (case/leading-zero/whitespace-insensitive) `parcel_id` duplicates: Bay 7 groups/15 rows, Walton 1 group/2 rows.
- **`parcelno` duplicates within county** (this is the app's lookup key): **Leon 5,262 groups / 48,574 rows**, Duval 95 / 221, Baker 7 / 36, Polk 6 / 24, Orange 5 / 10. In Leon, a notes/lead/search by `parcelno` can hit multiple parcels.
- `alt_key`: no duplicates.

### Parcel ID formatting (inconsistent between counties and between the two ID columns)
- `parcel_id` is `varchar`, so leading zeros are not lost at the column level. But `parcel_id` and `parcelno` disagree on 3.69M rows (33.7%).
- **Pasco:** every `parcel_id` is prefixed `Pasco-` (e.g. `Pasco-36-26-21-0020-49900-1070`), plus 2 garbage rows (`Pasco--- ---`). 0% match to NAL; `parcelno` matches 99%.
- **Clay and Duval:** `parcel_id` entirely NULL; only `parcelno` is populated (Duval `parcelno` has 126 duplicate rows).
- **Brevard:** DB IDs reformatted with dashes (`20-34-04-00-1`) vs NAL `20 3404-00-1` (1% exact, 99% after normalization). **Polk:** DB dashed `22-26-01-000000-011000` vs NAL digits-only (0% exact, 99% normalized).
- All-numeric IDs range from 0% to 100% by county, and many counties have 20–100% of IDs starting with `0`. They are being kept as strings, which is correct, but a reload that cast to number would corrupt them.
- `parcel_id` length varies wildly inside some counties (e.g. Martin 3–24, Union 3–27, Putnam 1–24, Pasco 11–30), suggesting appended junk/prefix variants.
- Lowercase letters in 314,507 IDs (2.9%).

### Attributes without geometry / geometry without attributes
- Attributes but no geometry: **17 rows** (all Baker).
- Geometry but no attributes: **164** (all Sumter). Geometry but no parcel ID: 503,307 (the Clay/Duval/Baker blank-ID rows; they do have `parcelno`).

---

## 4. Geometry

- **SRID: 4326 everywhere** (all parcel rows and every other spatial table). No mixed SRIDs. All parcel geometries are MULTIPOLYGON; none fall outside a Florida bounding box.
- **Invalid geometries (ST_IsValid=false): 2,454** of 10,938,036 (0.02%). Worst: Brevard 598, Martin 303, Palm Beach 268, Broward 138, Polk 107. Pasco has 0.
- **Empty geometries: 25** (Pasco 14, Liberty 5, Escambia 2, Alachua/Franklin/Jackson/Jefferson 1 each).
- Small tables (`highways`, `traffic_stats`, `interstates`, `us_roads`): 0 invalid, 0 empty. `flood_hazard`: no null geom/geom_safe; validity not scanned (11 GB).
- **GIST indexes present** on `parcels.geom`, `flood_hazard.geom` and `geom_safe`, `highways`, `traffic_stats`, `interstates`, `us_roads`, and both FEMA cache tables. (`flood_hazard` has two identical GIST indexes on `geom`, `flood_hazard_geom_gix` and `idx_flood_hazard_geom`, so one is redundant.)
- Spot check (1% sample): ~1% of parcels have stored `acreage` more than 10% off from geography-computed area. Minor, probably projection/rounding differences.

---

## 5. Field-mapping readiness (DB vs. Florida DOR NAL)

Mapping is **1:1 by name, with shapefile-style truncation** in the DB. No renaming logic is needed beyond the truncation table the load scripts already embody.

| NAL field | DB column | Status |
|---|---|---|
| CO_NO, PARCEL_ID, FILE_T, ASMNT_YR, DOR_UC, PA_UC, JV, OWN_NAME, OWN_ADDR1/2, OWN_CITY/STATE/ZIPCD, PHY_ADDR1/2, PHY_CITY/ZIPCD, S_LEGAL, SALE_PRC1/2, SALE_YR1/2, SALE_MO1/2, ALT_KEY, etc. | same name (lowercase) | **Column exists; many are unpopulated** (see §3) |
| JV_NON_HMSTD_RESD, AV_NON_HMSTD_RESD, JV_RESD_NON_RESD, AV_RESD_NON_RESD, JV_CLASS_USE, JV_H2O_RECHRGE, JV_CONSRV_LND, JV_HIST_COM_PROP, JV_HIST_SIGNF, JV_WRKNG_WTRFNT | `jv_non_hms, av_non_hms, jv_resd_no, av_resd_no, jv_class_u, jv_h2o_rec, jv_consrv_, jv_hist_co, jv_hist_si, jv_wrkng_w` | truncated, maps cleanly |
| DT_LAST_INSPT, LND_UNTS_CD, NO_LND_UNTS, CONST_CLASS, TOT_LVG_AREA, NO_BULDNG, NO_RES_UNTS, SPEC_FEAT_VAL, MULTI_PAR_SAL1, SAL_CHNG_CD1, OWN_STATE_DOM, CO_APP_STAT, TAX_AUTH_CD, ASS_TRNSFR_FG, PREV_HMSTD_OWN, ASS_DIF_TRNS, CONO_PRV_HM, PARCEL_ID_PRV_HMSTD, YR_VAL_TRNSF, STATE_PAR_ID, SPC_CIR_TXT | `dt_last_in, lnd_unts_c, no_lnd_unt, const_clas, tot_lvg_ar, no_buldng, no_res_unt, spec_feat_, m_par_sal1, s_chng_cd1, own_state_, co_app_sta, tax_auth_c, ass_trnsfr, prev_hmstd, ass_dif_tr, cono_prv_h, parcel_id_, yr_val_trn, state_par_, spc_cir_tx` | truncated, maps cleanly (watch `parcel_id_` vs `parcel_id`) |
| **EXMPT_01 … EXMPT_46, EXMPT_80–82** | none | **Missing in DB** |
| SDF (sales data file) fields | none | **No SDF load.** Only the 2 sales slots embedded in NAL exist, and those are mostly unpopulated |

**Custom fields that are not in DOR and must be preserved/recomputed on reload:**
- `gid` (PK, referenced by the app as parcel `id`), `parcelno`, `oid_` (from the shapefile; `parcelno` is the **app's join key** for notes/leads/search, so its values must stay stable)
- `county` (clean name; note "Saint Johns"/"Saint Lucie"/"Desoto" spellings, which `lib/counties.ts` presumably matches)
- Computed: `acreage`, `latitude`, `longitude`, `geojson`, `out_of_state`, `distance_to_highway`
- CRM: `phone_number`, `phone_verified`, `email`, `email_verified` (all empty today)
- Related tables to keep: `user_parcel_notes`, `leads`, `users`, `user_county_access`, usage tables (they reference `parcelno`/`user_id`, not `gid`).

**None of the custom columns hold irreplaceable data today**, because the CRM fields are empty and the others are derivable from geometry/NAL.

---

## 6. App health

**Build:** `npm run build` (Next.js 16.1.4 Turbopack) **succeeds** (exit 0), TypeScript passes, 32 static pages generated. Warnings only:
1. `The "middleware" file convention is deprecated. Please use "proxy" instead.`
2. `Using edge runtime on a page currently disables static generation for that page` (`app/api/chat/route.ts` sets `runtime = 'edge'`).
(`npm run lint` was not run.)

**Env vars.** Present in `.env.local` (names only): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `DATABASE_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
Referenced by the code but **not in `.env.local`**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{SCOUT,REGIONAL,LOCAL,ADDON}_MONTHLY`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `POSTGRES_URL` (used by `app/api/webhooks/stripe/route.ts` instead of `DATABASE_URL`). They may be set in Vercel (the Vercel CLI isn't installed here, so I did not check). `.env.local` is gitignored (good).

**Things worth knowing in the app code:**
- `middleware.ts` marks `"/api(.*)"` as a **public route**, so Clerk does not protect any API route at the middleware level. Each handler must do its own auth. I did not audit each route.
- Search/notes/leads are keyed on `parcelno`, which has no index and has duplicates (Leon).
- DB connects with `rejectUnauthorized:false`; scripts also set `NODE_TLS_REJECT_UNAUTHORIZED='0'` (`scripts/load-county.js`).

**Import/ingest scripts.** `scripts/` has ~385 files (plus ~25 loose `.js/.sql` in the repo root). Categories:
- **Per-county loaders:** 95 `load-*.js` (`load-<county>-sample.js` and `-full.js` for ~38 counties, plus generic `load-county.js`, `load-single-county.js`, `load-parcels.js`, `complete-load-parcels.js`, `load-large.js`). They read `D:\LandOracle\Florida\<County>\gis\*.shp` + the NAL CSV, reproject with proj4 (county-specific EPSG guessed per script), and insert in batches. Many are hard-coded to one county and some skip IDs that already exist.
- **Gap-repair / heal:** `heal-deficient.js`, `analyze-*-gap.js`, `repair*`, `audit-statewide.js`, `autopilot-parcels.js`, `fix-*` (coordinates, Pasco geometry/DOR/parcelno, Sarasota geom, constraints, county names).
- **Derived-field jobs:** `calc-distances.js`, `backfill_geom.js`, `add_acreage_column.js`, `convert-columns-to-numeric.js`, `migrate-jv.js`, `migrate-phy-addr.js`.
- **Reference layers:** `load-aadt.js`, `load-highways.js`, `load-flood-hazard.js` (+ `resume-flood-hazard-*`, `optimize-*`, `repair-flood-view.js`).
- **Admin/user:** `init-*`, `migrate-*`, `promote-*`, `manage-users.js`, `grant-access.js`.
- Dozens of `inspect-*`, `check-*`, `debug-*`, `verify-*` one-offs.
- Not a reproducible pipeline: no single entry point, county-specific hacks, hard-coded `D:\` paths, and the DB state is the product of many patch scripts.

**Git.** Last commit `cba7594` on **Thu Jan 29 2026** ("Update Traffic label to Average Daily Traffic"); 19 commits total. **31 working-tree entries uncommitted** (9 modified tracked files with ~1,200 insertions, 4 staged-and-further-modified, plus ~20 untracked audit/log/json files and `components/dashboard/GeocoderControl.tsx`). File mtimes show work through Apr 2026 (package.json, scripts) that is not committed, and `app/api/map/flood/route.ts` is staged but uncommitted. A repo-root `dump.sql` (11.7 GB) is gitignored.

---

## Verdict

**Solid**
- Geometry: single SRID (4326), 99.98% valid, GIST indexes everywhere that matters, all 67 counties loaded.
- Identity/valuation core for most counties: parcel ID, owner, mailing address, DOR use code, JV, acreage, lat/long. The unique `(county, parcel_id)` constraint holds.
- App builds cleanly. The reference layers (flood, traffic, highways) are loaded and indexed.
- The raw source is intact on disk: DOR 2025 NAL CSVs + county shapefiles for essentially every county.

**Broken / misleading**
- **No tax-year field** (`asmnt_yr` NULL except Baker) and no import date.
- **Last sale price/date is effectively absent (99.88% null)**, and most other NAL fields (land value, living area, year built, legal, exemptions, 2nd sale) were never loaded. Only ~20 of ~120 NAL columns are populated.
- **Situs address is blank for ~79% of parcels** (100% in 40 counties) although NAL has it.
- **Sumter** (no JV/acreage/mailing), **Volusia** (no owner/mailing, loaded from a "generated" file), **Charlotte/Santa Rosa** mailing.
- **ID mess:** Clay and Duval have no `parcel_id`; Pasco IDs carry a `Pasco-` prefix; Brevard/Polk IDs reformatted vs DOR; `parcel_id` ≠ `parcelno` on 34% of rows; Leon has 48,574 rows sharing duplicate `parcelno` values, and the app keys on `parcelno` (with no index).
- ~118K parcels (1.1%) in the DOR files are missing from the DB, concentrated in Suwannee (18%), Calhoun (13%), Santa Rosa, Saint Johns, Gulf, Escambia; Pasco ~4%; Walton/Washington have no NAL source on disk.
- 2,454 invalid + 25 empty geometries; uncommitted work since January; `/api` unprotected at middleware level; Stripe/Clerk-webhook env vars absent locally.

**Recommendation: (a) reload from DOR files, but as a controlled attribute reload, not a blind wipe.**
Custom fields are not a blocker: the only "custom" columns on `parcels` are derived (`acreage`, lat/long, `geojson`, `out_of_state`, `distance_to_highway`) or empty (phone/email), and the user-data tables are separate and reference `parcelno`. Patching would mean fixing ~15 independent problems across 67 counties on top of ~380 one-off scripts. A single, reproducible NAL loader fixes sales, situs, exemptions, vintage, and ID normalization in one pass.

How I'd do it to stay safe:
1. Build one generic NAL→staging-table loader (stage in a new table; swap or `UPDATE … FROM` by key after validation). **Keep existing geometry and `gid`** where the key matches, reload attributes only, and insert the ~118K missing parcels from the shapefiles.
2. **Decide the canonical key first.** Add `parcel_id` normalization (strip `Pasco-`, fill Clay/Duval from NAL, consistent punctuation) and keep `parcelno` values stable so notes/leads stay attached. Resolve the Leon `parcelno` duplicates, and index `parcelno`.
3. Populate `asmnt_yr`, `co_no`, and add a `roll_source`/`loaded_at` column per county.
4. Get a real Volusia NAL (the on-disk file is generated) and NAL files for Walton and Washington; reconcile the Sumter load.
5. Recompute `acreage`/`latitude`/`longitude`/`out_of_state` from the reloaded rows; run `ST_MakeValid` on the 2,454 invalid geometries; `ANALYZE` afterwards.
6. Take a `pg_dump` of `parcels` and the user tables before any write (the 11.7 GB `dump.sql` is from January and predates the April repairs).

If a reload is off the table, the minimum patch list is: situs address and sale price/year from NAL by `parcelno` (one SQL `UPDATE … FROM` per county), fix Sumter/Volusia, normalize Pasco/Clay/Duval IDs, and add the `parcelno` index.

*Caveats:* match rates use normalized IDs and county-name mapping assumed 1:1 with folder names; the NAL-missing counts are therefore approximate. The 1% sample stats (field population, acreage) are from a block sample, not the full table. Per-county tables for every field are reproducible from the queries described above.
