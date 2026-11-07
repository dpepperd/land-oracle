# parcels_v2 build report

Generated 2026-11-07 from the live database. v1 (`parcels`) was not modified; nothing swapped or dropped.

## 1. Row counts, v2 vs v1

**v1 10,938,053 rows → v2 10,937,842 rows** (211 rows folded away by merges; every v1 gid is covered exactly once: covered=10,938,053 ✓).

| County | v1 | v2 | merged away | suffixed rows | quarantined | other needs_review |
|---|---:|---:|---:|---:|---:|---:|
| Alachua | 108,617 | 108,617 | 0 | 0 | 0 | 3 |
| Baker | 12,831 | 12,802 | 29 | 0 | 18 | 0 |
| Bay | 128,918 | 128,909 | 9 | 0 | 0 | 0 |
| Bradford | 15,671 | 15,671 | 0 | 0 | 0 | 0 |
| Brevard | 349,742 | 349,696 | 46 | 0 | 0 | 0 |
| Broward | 764,726 | 764,726 | 0 | 0 | 0 | 0 |
| Calhoun | 11,618 | 11,618 | 0 | 0 | 0 | 0 |
| Charlotte | 222,414 | 222,414 | 0 | 0 | 0 | 0 |
| Citrus | 142,800 | 142,800 | 0 | 0 | 0 | 0 |
| Clay | 102,571 | 102,571 | 0 | 0 | 0 | 0 |
| Collier | 291,577 | 291,577 | 0 | 0 | 0 | 0 |
| Columbia | 37,554 | 37,554 | 0 | 0 | 0 | 0 |
| Desoto | 20,128 | 20,128 | 0 | 0 | 0 | 0 |
| Dixie | 16,383 | 16,383 | 0 | 0 | 0 | 0 |
| Duval | 400,585 | 400,459 | 126 | 0 | 0 | 0 |
| Escambia | 162,691 | 162,690 | 1 | 0 | 0 | 2 |
| Flagler | 86,683 | 86,683 | 0 | 0 | 0 | 0 |
| Franklin | 18,177 | 18,177 | 0 | 0 | 0 | 1 |
| Gadsden | 27,560 | 27,560 | 0 | 0 | 0 | 1 |
| Gilchrist | 14,062 | 14,062 | 0 | 0 | 0 | 0 |
| Glades | 11,383 | 11,383 | 0 | 0 | 0 | 0 |
| Gulf | 18,788 | 18,788 | 0 | 0 | 0 | 0 |
| Hamilton | 12,857 | 12,857 | 0 | 0 | 0 | 0 |
| Hardee | 14,740 | 14,740 | 0 | 0 | 0 | 0 |
| Hendry | 35,892 | 35,892 | 0 | 0 | 0 | 0 |
| Hernando | 118,524 | 118,524 | 0 | 0 | 0 | 0 |
| Highlands | 113,108 | 113,108 | 0 | 0 | 0 | 0 |
| Hillsborough | 527,834 | 527,834 | 0 | 0 | 0 | 0 |
| Holmes | 14,507 | 14,507 | 0 | 0 | 0 | 0 |
| Indian River | 94,790 | 94,790 | 0 | 0 | 0 | 0 |
| Jackson | 39,889 | 39,889 | 0 | 0 | 0 | 1 |
| Jefferson | 12,092 | 12,092 | 0 | 0 | 0 | 1 |
| Lafayette | 7,233 | 7,233 | 0 | 0 | 0 | 0 |
| Lake | 211,312 | 211,312 | 0 | 0 | 1 | 0 |
| Lee | 559,124 | 559,124 | 0 | 0 | 0 | 0 |
| Leon | 112,434 | 112,434 | 0 | 0 | 0 | 0 |
| Levy | 47,512 | 47,512 | 0 | 0 | 0 | 0 |
| Liberty | 5,885 | 5,885 | 0 | 0 | 0 | 5 |
| Madison | 15,967 | 15,967 | 0 | 0 | 0 | 0 |
| Manatee | 224,518 | 224,518 | 0 | 0 | 0 | 1 |
| Marion | 285,015 | 285,015 | 0 | 0 | 0 | 0 |
| Martin | 96,874 | 96,874 | 0 | 0 | 0 | 0 |
| Miami-Dade | 936,467 | 936,467 | 0 | 0 | 0 | 0 |
| Monroe | 89,044 | 89,044 | 0 | 0 | 0 | 0 |
| Nassau | 57,560 | 57,560 | 0 | 0 | 0 | 0 |
| Okaloosa | 111,818 | 111,818 | 0 | 0 | 0 | 0 |
| Okeechobee | 31,639 | 31,639 | 0 | 0 | 0 | 2 |
| Orange | 490,946 | 490,946 | 0 | 0 | 0 | 0 |
| Osceola | 207,733 | 207,733 | 0 | 0 | 0 | 0 |
| Palm Beach | 658,030 | 658,030 | 0 | 0 | 0 | 0 |
| Pasco | 314,425 | 314,425 | 0 | 0 | 2 | 14 |
| Pinellas | 436,038 | 436,038 | 0 | 0 | 0 | 0 |
| Polk | 426,311 | 426,311 | 0 | 0 | 0 | 0 |
| Putnam | 97,860 | 97,860 | 0 | 0 | 0 | 0 |
| Saint Johns | 152,638 | 152,638 | 0 | 0 | 0 | 0 |
| Saint Lucie | 188,676 | 188,676 | 0 | 0 | 0 | 1 |
| Santa Rosa | 109,634 | 109,634 | 0 | 0 | 0 | 0 |
| Sarasota | 304,908 | 304,908 | 0 | 0 | 0 | 1 |
| Seminole | 180,662 | 180,662 | 0 | 0 | 0 | 0 |
| Sumter | 99,406 | 99,406 | 0 | 0 | 0 | 0 |
| Suwannee | 31,906 | 31,906 | 0 | 0 | 0 | 0 |
| Taylor | 18,798 | 18,798 | 0 | 0 | 0 | 1 |
| Union | 6,960 | 6,960 | 0 | 0 | 0 | 0 |
| Volusia | 311,552 | 311,552 | 0 | 0 | 0 | 11 |
| Wakulla | 26,684 | 26,684 | 0 | 0 | 0 | 0 |
| Walton | 89,004 | 89,004 | 0 | 2 | 0 | 18 |
| Washington | 43,768 | 43,768 | 0 | 0 | 0 | 0 |
| **Total** | **10,938,053** | **10,937,842** | **211** | **2** | **21** | **63** |

## 2. Collision outcomes (separator-preserving key)

| County | Outcome | v2 rows | v1 rows involved |
|---|---|---:|---:|
| Baker | merged: identical own_name+jv+dor_uc | 7 | 36 |
| Bay | merged: identical own_name+jv+dor_uc | 7 | 16 |
| Brevard | merged: identical own_name+jv+dor_uc | 46 | 92 |
| Duval | merged: Duval split parcel | 95 | 221 |
| Escambia | merged: identical own_name+jv+dor_uc | 1 | 2 |
| Walton | suffixed -dN, needs_review | 2 | 2 |

Suffixed examples:

- Walton: `76-262S214270000000A0-d1` (parcel_id `262S214270000000A0`)
- Walton: `76-262S214270000000A0-d2` (parcel_id `262s214270000000A0`)

## 3. Quarantined rows (no usable key)

Total quarantined: **21** (parcel_key NULL, excluded from the unique index).

| County | Rows | of which empty geometry | raw ids (parcel_id/parcelno) |
|---|---:|---:|---|
| Baker | 18 | 17 | ∅/∅ |
| Lake | 1 | 0 | -----/----- |
| Pasco | 2 | 0 | Pasco--- ---/-- --- ; Pasco------/----- |

Note: Phase 1 counted 26 rows with no key under the *strict* normalizer. Under the separator-preserving key used for `parcel_key`, 21 are quarantined (Baker 18, Lake 1, Pasco 2) and 5 (Bradford 1, Hamilton 4 — IDs made only of symbols) still get a parcel_key, but their `match_key` is NULL.
Rows with a parcel_key but no match_key: Bradford 1, Hamilton 4.

## 4. Geometry

- ST_MakeValid applied to rows: **2,436** (v1 had 2,454 invalid parcel geometries; a merged row counts once even if several members were invalid)
- Unfixable (empty after MakeValid): **18**
- v1 empty/NULL geometry carried as NULL: **42** rows flagged `empty_geom`; v2 rows with NULL geom in total: 60
- v2 rows still invalid: **0**; non-MultiPolygon: **0**
- Area change on fixed single-row parcels (n=2,436): median 0.0000%, p99 0.768%, max 62.68%; 18 changed by more than 5%.
- Flagged needs_review (area change > 5%, migration 006): 18 parcels. Largest: Saint Lucie `4306-703-0182-000-8` 62.7%, Volusia `3061926` 41.3%, Volusia `4524291` 40.6%, Volusia `4630392` 39.9%, Walton `163N19190140000050` 34.7%, Gadsden `3-11-2N-4W-0000-00444-1000` 29.8%
- Most fixes: Brevard 598, Martin 303, Palm Beach 268, Broward 138, Polk 107, Lee 64

## 5. Leon

- v1: parcelno ≠ parcel_id on 47,956 of 112,434 rows.
- v2: `parcelno_legacy` repaired from the shapefile on **47,956** rows; 0 rows have no shapefile match (parcelno_legacy NULL, needs_review). 112,434 of 112,434 now have parcelno_legacy = parcel_id; distinct parcelno_legacy = 112,434.
- Remaining duplicate parcelno_legacy groups in Leon v2: **0** (0 rows).

## 6. Keys and indexes

- v2 rows 10,937,842; with parcel_key 10,937,821; distinct parcel_key 10,937,821 ✓ unique
- index `parcels_v2_co_no_idx` 72 MB
- index `parcels_v2_geom_gix` 455 MB
- index `parcels_v2_match_key_idx` 387 MB
- index `parcels_v2_parcel_key_uq` 420 MB
- index `parcels_v2_pkey` 237 MB
- parcels_v2 total 8231 MB; database now 40 GB

## 7. parcels.own_name vs source shapefiles

Compared (upper-cased, whitespace-collapsed) `own_name` in v1 to `OWN_NAME` in each county's source `.dbf`, matching on parcel id / parcelno. "Differ" = both non-blank and not equal, i.e. candidates for manual edits (or a source that changed between loads).

| County | DB rows | matched | same | DB blank, source has | DB has, source blank | **differ** | not found |
|---|---:|---:|---:|---:|---:|---:|---:|
| Alachua | 108,617 | 108,617 | 104,780 | 19 | 7 | 3,811 | 0 |
| Baker | 12,831 | 12,813 | 12,813 | 0 | 0 | 0 | 18 |
| Bay | 128,918 | 128,918 | 123,034 | 60 | 8 | 5,816 | 0 |
| Bradford | 15,671 | 15,670 | 15,213 | 0 | 0 | 457 | 1 |
| Brevard | 349,742 | 349,742 | 339,623 | 117 | 34 | 9,968 | 0 |
| Broward | 764,726 | 764,726 | 742,525 | 348 | 32 | 21,821 | 0 |
| Calhoun | 11,618 | 11,618 | 11,618 | 0 | 0 | 0 | 0 |
| Charlotte | 222,414 | 222,414 | 215,953 | 238 | 8 | 6,215 | 0 |
| Citrus | 142,800 | 142,800 | 142,800 | 0 | 0 | 0 | 0 |
| Clay | 102,571 | 102,571 | 102,571 | 0 | 0 | 0 | 0 |
| Collier | 291,577 | 291,577 | 285,639 | 29 | 9 | 5,900 | 0 |
| Columbia | 37,554 | 37,554 | 37,554 | 0 | 0 | 0 | 0 |
| Desoto | 20,128 | 20,128 | 19,664 | 11 | 1 | 452 | 0 |
| Dixie | 16,383 | 16,383 | 16,383 | 0 | 0 | 0 | 0 |
| Duval | 400,585 | 400,585 | 400,585 | 0 | 0 | 0 | 0 |
| Escambia | 162,691 | 162,691 | 162,691 | 0 | 0 | 0 | 0 |
| Flagler | 86,683 | 86,683 | 84,174 | 25 | 8 | 2,476 | 0 |
| Franklin | 18,177 | 18,177 | 18,177 | 0 | 0 | 0 | 0 |
| Gadsden | 27,560 | 27,560 | 26,991 | 20 | 4 | 545 | 0 |
| Gilchrist | 14,062 | 14,062 | 13,715 | 8 | 2 | 337 | 0 |
| Glades | 11,383 | 11,383 | 11,203 | 6 | 1 | 173 | 0 |
| Gulf | 18,788 | 18,788 | 18,788 | 0 | 0 | 0 | 0 |
| Hamilton | 12,857 | 12,853 | 12,486 | 28 | 3 | 336 | 4 |
| Hardee | 14,740 | 14,740 | 14,448 | 7 | 1 | 284 | 0 |
| Hendry | 35,892 | 35,892 | 34,957 | 39 | 2 | 894 | 0 |
| Hernando | 118,524 | 118,524 | 118,524 | 0 | 0 | 0 | 0 |
| Highlands | 113,108 | 113,108 | 110,674 | 37 | 13 | 2,384 | 0 |
| Hillsborough | 527,834 | 527,834 | 513,786 | 617 | 44 | 13,387 | 0 |
| Holmes | 14,507 | 14,507 | 14,507 | 0 | 0 | 0 | 0 |
| Indian River | 94,790 | 94,790 | 91,685 | 48 | 15 | 3,042 | 0 |
| Jackson | 39,889 | 39,889 | 38,687 | 31 | 1 | 1,170 | 0 |
| Jefferson | 12,092 | 12,092 | 11,751 | 19 | 7 | 315 | 0 |
| Lafayette | 7,233 | 7,233 | 7,233 | 0 | 0 | 0 | 0 |
| Lake | 211,312 | 211,311 | 202,124 | 203 | 35 | 8,949 | 1 |
| Lee | 559,124 | 559,124 | 541,793 | 642 | 34 | 16,655 | 0 |
| Leon | 112,434 | 112,434 | 109,188 | 232 | 22 | 2,992 | 0 |
| Levy | 47,512 | 47,512 | 46,058 | 32 | 1 | 1,421 | 0 |
| Liberty | 5,885 | 5,885 | 5,839 | 3 | 2 | 41 | 0 |
| Madison | 15,967 | 15,967 | 15,862 | 0 | 2 | 103 | 0 |
| Manatee | 224,518 | 224,518 | 218,395 | 146 | 0 | 5,977 | 0 |
| Marion | 285,015 | 285,015 | 271,886 | 190 | 30 | 12,909 | 0 |
| Martin | 96,874 | 96,874 | 94,560 | 24 | 14 | 2,276 | 0 |
| Miami-Dade | 936,467 | 936,467 | 917,238 | 132 | 85 | 19,012 | 0 |
| Monroe | 89,044 | 89,044 | 87,746 | 23 | 11 | 1,264 | 0 |
| Nassau | 57,560 | 57,560 | 56,002 | 29 | 3 | 1,526 | 0 |
| Okaloosa | 111,818 | 111,818 | 111,818 | 0 | 0 | 0 | 0 |
| Okeechobee | 31,639 | 31,639 | 30,656 | 72 | 6 | 905 | 0 |
| Orange | 490,946 | 490,946 | 477,751 | 260 | 36 | 12,899 | 0 |
| Osceola | 207,733 | 207,733 | 202,141 | 129 | 4 | 5,459 | 0 |
| Palm Beach | 658,030 | 658,030 | 640,047 | 113 | 75 | 17,795 | 0 |
| Pasco | 314,425 | 314,423 | 314,423 | 0 | 0 | 0 | 2 |
| Pinellas | 436,038 | 436,038 | 426,226 | 158 | 36 | 9,618 | 0 |
| Polk | 426,311 | 426,311 | 415,005 | 413 | 0 | 10,893 | 0 |
| Putnam | 97,860 | 97,860 | 94,105 | 76 | 7 | 3,672 | 0 |
| Saint Johns | 152,638 | 152,638 | 147,973 | 29 | 16 | 4,620 | 0 |
| Saint Lucie | 188,676 | 188,676 | 182,857 | 117 | 14 | 5,688 | 0 |
| Santa Rosa | 109,634 | 109,634 | 109,634 | 0 | 0 | 0 | 0 |
| Sarasota | 304,908 | 304,908 | 297,297 | 28 | 13 | 7,570 | 0 |
| Seminole | 180,662 | 180,662 | 176,017 | 141 | 19 | 4,485 | 0 |
| Sumter | 99,406 | 99,406 | 99,406 | 0 | 0 | 0 | 0 |
| Suwannee | 31,906 | 31,906 | 31,906 | 0 | 0 | 0 | 0 |
| Taylor | 18,798 | 18,798 | 18,798 | 0 | 0 | 0 | 0 |
| Union | 6,960 | 6,960 | 6,771 | 3 | 2 | 184 | 0 |
| Volusia | 311,552 | 0 | 0 | 0 | 0 | 0 | 311,552 |
| Wakulla | 26,684 | 26,684 | 25,709 | 52 | 3 | 920 | 0 |
| Walton | 89,004 | 89,004 | 89,003 | 1 | 0 | 0 | 0 |
| Washington | 43,768 | 43,768 | 43,768 | 0 | 0 | 0 | 0 |
| **Total** | 10,938,053 | 10,626,475 | 10,383,234 | 4,955 | 670 | **237,616** | 311,578 |

Leon samples (2992 differ):

(Owner names are deliberately omitted from this committed report; parcel ids shown.)

- `223514  K0140`
- `223315  D0020`
- `223514  J0070`
- `223514  K0020`
- `223514  K0010`
- `223514  L0010`
- `223514  L0020`
- `233405  C0140`

### 7b. Rows that differ from the shapefile: do they match the DOR NAL file?

Second pass over the counties above whose v1 `own_name` differs from the shapefile. `equals NAL` = v1 matches the NAL CSV (the shapefile is simply a different vintage). **`neither` = v1 matches neither source: the real manual-edit / corruption candidates.**

| County | differ from shapefile | equals NAL | **neither** | not in NAL |
|---|---:|---:|---:|---:|
| Alachua | 3,811 | 3,811 | 0 | 0 |
| Bay | 5,816 | 5,816 | 0 | 0 |
| Bradford | 457 | 457 | 0 | 0 |
| Brevard | 9,968 | 9,362 | 606 | 0 |
| Broward | 21,821 | 21,821 | 0 | 0 |
| Charlotte | 6,215 | 6,215 | 0 | 0 |
| Collier | 5,900 | 5,900 | 0 | 0 |
| Desoto | 452 | 452 | 0 | 0 |
| Flagler | 2,476 | 2,476 | 0 | 0 |
| Gadsden | 545 | 545 | 0 | 0 |
| Gilchrist | 337 | 337 | 0 | 0 |
| Glades | 173 | 173 | 0 | 0 |
| Hamilton | 336 | 336 | 0 | 0 |
| Hardee | 284 | 284 | 0 | 0 |
| Hendry | 894 | 894 | 0 | 0 |
| Highlands | 2,384 | 2,384 | 0 | 0 |
| Hillsborough | 13,387 | 13,387 | 0 | 0 |
| Indian River | 3,042 | 3,042 | 0 | 0 |
| Jackson | 1,170 | 1,170 | 0 | 0 |
| Jefferson | 315 | 315 | 0 | 0 |
| Lake | 8,949 | 8,949 | 0 | 0 |
| Lee | 16,655 | 16,655 | 0 | 0 |
| Leon | 2,992 | 2,992 | 0 | 0 |
| Levy | 1,421 | 1,421 | 0 | 0 |
| Liberty | 41 | 41 | 0 | 0 |
| Madison | 103 | 103 | 0 | 0 |
| Manatee | 5,977 | 5,977 | 0 | 0 |
| Marion | 12,909 | 11,296 | 1,613 | 0 |
| Martin | 2,276 | 2,276 | 0 | 0 |
| Miami-Dade | 19,012 | 19,012 | 0 | 0 |
| Monroe | 1,264 | 1,264 | 0 | 0 |
| Nassau | 1,526 | 1,526 | 0 | 0 |
| Okeechobee | 905 | 905 | 0 | 0 |
| Orange | 12,899 | 12,899 | 0 | 0 |
| Osceola | 5,459 | 5,459 | 0 | 0 |
| Palm Beach | 17,795 | 17,795 | 0 | 0 |
| Pinellas | 9,618 | 9,618 | 0 | 0 |
| Polk | 10,893 | 10,893 | 0 | 0 |
| Putnam | 3,672 | 3,672 | 0 | 0 |
| Saint Johns | 4,620 | 4,620 | 0 | 0 |
| Saint Lucie | 5,688 | 5,688 | 0 | 0 |
| Sarasota | 7,570 | 7,570 | 0 | 0 |
| Seminole | 4,485 | 4,485 | 0 | 0 |
| Union | 184 | 184 | 0 | 0 |
| Wakulla | 920 | 920 | 0 | 0 |
| **Total** | 237,616 | 235,397 | **2,219** | 0 |

Parcel ids of `neither` rows (first few per county; names omitted): Brevard: `23-35-24-BE-1-29`, `24-35-02-01-21-8`, `24-35-02-01-21-7`, `24-35-02-01-21-6`, `30-38-23-HI-5-12`, `27-37-36-EO-51-3` | Marion: `3129-002-005`, `26827-001-02`, `24261-009-01`, `8009-1187-03`, `8003-0395-03`, `2863-200-000`

**Reading this:**
- ~99% of rows that differ from the shapefile equal the NAL file, so v1 `own_name` was loaded from NAL for those counties and the shapefile is just a different vintage. Leon (2,992 differences) is entirely in this bucket.
- The `neither` rows (Brevard, Marion) are cases where the shapefile and NAL agree with each other and v1 disagrees with both. Spot checks (locally; names not reproduced here) show a different person, mixed name formats and 30-character truncation, which looks like an older load rather than hand edits.
- **No proof of manual edits either way.** `phone_number` and `email` are NULL on every row, but `phone_verified`/`email_verified` default to `false`, so rows touched by `PATCH /api/parcels/[id]` cannot be told apart, and the admin UI may save an owner name with blank contact fields. If any admin edits exist they are inside the `neither` set.
- Volusia has no matching shapefile keys (0 matched), so it could not be compared; its v1 `own_name` is blank for every row.
