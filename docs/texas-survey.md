# Texas survey: TxGIO StratMap Land Parcels (research only, 2026-11-11)

Scope: read-only research. Nothing was written to any database and no large file was downloaded. Numbers marked "sample" come from 12 random points per county (200 for the five deep counties) queried through TxGIO's public web service, so small percentages have wide error bars (plus or minus about 15 points for the 12-point samples).

Source page: https://www.geographic.texas.gov/stratmap/land-parcels.html
Catalog record (TxGIO/TNRIS API): https://api.tnris.org/api/v1/collections/0fa04328-872e-481c-b453-126a74777593
Web service: https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer

## 1. Short verdict

- License is the best of any state surveyed: the catalog tags the dataset **CC0 1.0 (public domain dedication)**.
- Coverage is complete on paper: all 254 counties have a 2025 file, and every county answered in sampling.
- Owner name and mailing address are present in nearly every county (owner >= 80% in 242 of 254 sampled counties, mailing >= 80% in 249).
- It is weaker than North Carolina for our core searches:
  - **Land use is empty in every county** (0 of 254 sampled). No "vacant land" filter; a stand-in is weak.
  - **There is no sale date.** The `date_acq` field is the date TxGIO acquired the county's file (same value for the whole county, stored as an Excel day number), not a sale.
  - **Values are patchy:** the biggest county, Harris, has almost no land or market value in the service (about 1-2% filled); Bexar has market value but no separate land value.
  - **Smith County has almost no owner or mailing data** (<30%); Johnson and Montague lack mailing; Crockett lacks owner.
  - Year built is filled in only a handful of counties.
- The service cannot be bulk-queried (no query operation), but the county files are public on TxGIO's S3 bucket (see section 5).

## 2. Terms of use (commercial redistribution)

From the catalog record (machine-readable metadata):
- license_name: "Creative Commons Zero v1.0 Universal"; license_abbreviation: CC0-1.0; license_url: https://spdx.org/licenses/CC0-1.0.html
- source_name: "Various Appraisal Districts"; authoritative: false

From the dataset description: "Data are provided by county appraisal districts or their service providers and then translated in the TxGIO common schema. ... presented 'AS-IS' based on the delivery by the local appraisal districts or their vendors. No values from the original data have been changed or removed. Additionally, StratMap Land Parcels are intended to be used as basemap and cartographic data and are not for detailed analysis. We encourage the user to reach out to the specific county appraisal district with questions regarding the attributes."

From the land-parcels page: the data are "not survey grade and should not be used for legal purposes"; "Not all counties are available"; TxGIO "will attempt to refresh annually from each appraisal district or their third party vendor. The refresh rate will vary across the state."

From the site-wide policy page (https://www.geographic.texas.gov/site-policies.html): "The Texas Water Development Board freely grants permission to copy and distribute its materials." Acknowledgment is "appreciated", not required.

Our reading (not legal advice):
- CC0 plus the site policy means commercial use and redistribution inside a paid product are permitted for TxGIO's compilation. Attribution is not required but cheap; credit "Texas Geographic Information Office (TxGIO) StratMap, from county appraisal districts".
- CC0 applies to what TxGIO can dedicate. The underlying owner records come from county appraisal districts; we did not verify each district's own terms. Texas appraisal data is generally public information, but this is UNVERIFIED.
- Texas Tax Code 25.025 hides home addresses of protected persons only (per the 50-state survey); no mailing-list statute was found. UNVERIFIED for solicitation rules.
- The data is "AS-IS", "not for detailed analysis": our "research only, verify with the county" wording already covers this.
- Open question for a cheap review: nothing blocking found, but we have not had a lawyer read it.

## 3. Coverage and data year

- Collection: StratMap 2025 Land Parcels, acquisition date 2025-06-01, published 2025-09-11. Every one of the 254 counties has a 2025 file (no county missing, none older than 2025, no tiny/empty files; smallest is Kenedy at about 0.3 MB).
- Inside the records the `tax_year` field read **2026** in all 2,917 sampled records, and each county's `date_acq` (file acquisition month) runs from early to mid 2026, so the "most recent" service appears newer than the 2025 collection name suggests. Treat the exact vintage as UNVERIFIED until a file is opened.
- Parcel count: not stated by TxGIO. The highest objectid seen was 14,305,886; objectids appear to run statewide, so there are roughly 14 million parcels (upper bound).
- Weak coverage in sampling: Donley (8% of random points hit a parcel), Aransas (42%), Cameron and Galveston (50%), Matagorda and Nueces and Calhoun (58%). Coastal counties may be partly water; Donley looks genuinely sparse.

## 4. Fill rates (sample)

Deep samples, 200 random points each (share of hit parcels with the field filled):

| County | Parcels hit | Owner | Mailing | Mail zip | Site address | Land value | Market value | Acres (GIS) | Land use | Year built |
|---|---|---|---|---|---|---|---|---|---|---|
| Travis (metro) | 94% | 98% | 100% | 98% | 98% | 80% | 98% | 99% | 0% | 0% |
| Harris (metro) | 84% | 100% | 100% | 98% | 100% | 1% | 1% | 0% | 0% | 57% |
| Bexar (metro) | 95% | 98% | 100% | 98% | 98% | 1% | 95% | 100% | 0% | 0% |
| Real (rural) | 100% | 98% | 100% | 98% | 55% | 98% | 98% | 100% | 0% | 6% |
| Hudspeth (rural) | 99% | 88% | 100% | 77% | 3% | 86% | 86% | 100% | 0% | 0% |

Follow-up 60-point samples (both land-use fields, legal vs GIS acres): land use (state and local codes) 0% in Travis, Harris, Bexar, Real, Hudspeth, Smith and Gregg. Harris has legal acres (63%) but no GIS acres; Smith has legal acres (100%) but almost nothing else; Gregg is a normal county (values 98%, year built 38%).

Statewide (12-point samples, 254 counties; share of counties with the field at 80%+):
- Owner 242, mailing 249, site address 160, land value 178, market value 220, GIS acres 232, year built 3, land use 0, `date_acq` 254 (but it is not a sale date).
- Counties with a field under 30%: owner 2 (Smith, Crockett), mailing 3 (Smith, Johnson, Montague), site address 53, land value 56, market value 25, acres 21, year built 212, land use 254.

## 5. Download path (for a future load)

- The TxGIO DataHub and data.geographic.texas.gov direct links returned HTTP 403 to automated requests. The map service has no query operation (count and feature queries are rejected); only point "identify" works, at close zoom.
- The underlying public S3 bucket is open and works with plain HTTP, listing and download:
  - https://tnris-data-warehouse.s3.amazonaws.com/LCD/collection/stratmap-2025-land-parcels/items/fgdb/stratmap-2025-land-parcels-real_48385_fgdb.zip (and `.../items/shp/..._shp.zip`), one per county. Real County: fgdb 1.9 MB, shapefile 2.4 MB (HTTP 200 confirmed).
  - Statewide combined: .../assets/48000/stratmap-2025-land-parcels_48.zip (2.8 GB).
- Reading the files needs a GIS reader (this machine has no GDAL; shapefiles can be read in Node, or GDAL can be installed through miniconda). Not done.
- Total county zips (both formats inside each) about 6.6 GB, excluding the 2.8 GB statewide file.

## 6. Estimated database size to load statewide

- Parcels: about 14 million.
- North Carolina's tested load measured about 1.8 KB per parcel (55 MB heap plus 9 MB indexes for 40,483 parcels). Applying that gives about **26 GB**. With the shape simplification used for flood (shapes trimmed to roughly 1-2 m), I would expect roughly **15 to 20 GB**. Plan range: **15 to 26 GB**.
- Where that leaves the 80 GiB disk: today about 15 GB (Florida plus NC test), plus NC about 8-11 GB, plus Texas 15-26 GB = about 40 to 52 GB. It fits, but Florida, NC and Texas together would use well over half the disk, and the 4 GB RAM database would be doing more work. Plan for a RAM upgrade conversation if searches slow down.
- Load time: NC loaded 40k parcels in 33 seconds; Texas at 14 million would be several hours from the county files, not from the service.

## 7. Recommendation

- Texas is legally the cleanest and the largest market, but the data is thinner than NC for what our users search on: no land use, no sale date, and unreliable values in Harris and Smith.
- What would work from day one: owner and mailing lookups, out-of-state owner search (mail state is present), acreage (GIS or legal acres), market value in most counties, county and map browsing.
- What would not work: "vacant land" and "no sale in N years" filters, and flood/value features in the counties noted above.
- Suggested order: NC first (already tested, loaded in progress); Texas after, as an admin-only pilot, with these gaps labelled in the app ("not available in this county").
- Before any Texas build: download the Travis, Harris and Bexar files from the public bucket and confirm that land use and values are really empty in the files and not only in the web service (the service and the files may differ). If the files have land use, the picture improves a lot.

## 8. All 254 counties

Columns: county file year (2025 for all), file size, then the sample from 12 random points (hit = share of points that landed on a parcel; other columns = share of hit parcels with the field filled), and the month the county's file was acquired (from `date_acq`). Flags: LOW HIT (hit < 70%), NO OWNER / NO MAIL (< 30%).

| County | FIPS | File year | File size | Hit | Owner | Mail | Site addr | Mkt value | Acres | File acquired | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Anderson | 48001 | 2025 | 19.3 MB | 100% | 100% | 100% | 100% | 100% | 0% | 2026-06 |  |
| Andrews | 48003 | 2025 | 4.3 MB | 100% | 100% | 100% | 50% | 100% | 100% | 2026-02 |  |
| Angelina | 48005 | 2025 | 32.3 MB | 100% | 100% | 100% | 75% | 100% | 100% | 2026-02 |  |
| Aransas | 48007 | 2025 | 12.0 MB | 42% | 100% | 100% | 100% | 100% | 100% | 2026-03 | LOW HIT |
| Archer | 48009 | 2025 | 5.6 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-09 |  |
| Armstrong | 48011 | 2025 | 1.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Atascosa | 48013 | 2025 | 16.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Austin | 48015 | 2025 | 12.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Bailey | 48017 | 2025 | 2.4 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-09 |  |
| Bandera | 48019 | 2025 | 18.8 MB | 100% | 92% | 100% | 75% | 92% | 100% | 2026-02 |  |
| Bastrop | 48021 | 2025 | 30.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Baylor | 48023 | 2025 | 2.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Bee | 48025 | 2025 | 10.7 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Bell | 48027 | 2025 | 73.9 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Bexar | 48029 | 2025 | 326.7 MB | 92% | 91% | 100% | 100% | 91% | 100% | 2026-07 |  |
| Blanco | 48031 | 2025 | 6.2 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-02 |  |
| Borden | 48033 | 2025 | 1.1 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-03 |  |
| Bosque | 48035 | 2025 | 104.2 MB | 92% | 91% | 100% | 100% | 91% | 100% | 2026-03 |  |
| Bowie | 48037 | 2025 | 21.9 MB | 92% | 100% | 91% | 91% | 100% | 100% | 2026-09 |  |
| Brazoria | 48039 | 2025 | 155.7 MB | 100% | 83% | 100% | 83% | 83% | 100% | 2026-03 |  |
| Brazos | 48041 | 2025 | 36.5 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Brewster | 48043 | 2025 | 9.7 MB | 92% | 100% | 100% | 27% | 100% | 100% | 2026-03 |  |
| Briscoe | 48045 | 2025 | 1.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-05 |  |
| Brooks | 48047 | 2025 | 2.8 MB | 92% | 91% | 100% | 64% | 91% | 100% | 2026-03 |  |
| Brown | 48049 | 2025 | 13.1 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Burleson | 48051 | 2025 | 11.2 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Burnet | 48053 | 2025 | 27.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Caldwell | 48055 | 2025 | 12.0 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Calhoun | 48057 | 2025 | 13.0 MB | 58% | 100% | 100% | 29% | 100% | 100% | 2026-03 | LOW HIT |
| Callahan | 48059 | 2025 | 5.0 MB | 100% | 75% | 100% | 75% | 75% | 100% | 2026-03 |  |
| Cameron | 48061 | 2025 | 88.8 MB | 50% | 100% | 100% | 100% | 100% | 0% | 2026-07 | LOW HIT |
| Camp | 48063 | 2025 | 6.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Carson | 48065 | 2025 | 2.5 MB | 100% | 100% | 100% | 33% | 100% | 100% | 2026-06 |  |
| Cass | 48067 | 2025 | 18.5 MB | 100% | 100% | 100% | 92% | 100% | 100% | 2026-03 |  |
| Castro | 48069 | 2025 | 2.6 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Chambers | 48071 | 2025 | 11.9 MB | 67% | 100% | 100% | 88% | 100% | 100% | 2026-06 | LOW HIT |
| Cherokee | 48073 | 2025 | 22.3 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-03 |  |
| Childress | 48075 | 2025 | 2.2 MB | 100% | 100% | 100% | 33% | 100% | 100% | 2026-06 |  |
| Clay | 48077 | 2025 | 10.1 MB | 100% | 100% | 100% | 17% | 100% | 100% | 2026-06 |  |
| Cochran | 48079 | 2025 | 2.7 MB | 100% | 83% | 100% | 0% | 83% | 100% | 2026-03 |  |
| Coke | 48081 | 2025 | 3.2 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Coleman | 48083 | 2025 | 5.9 MB | 100% | 100% | 100% | 50% | 100% | 100% | 2026-03 |  |
| Collin | 48085 | 2025 | 211.8 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Collingsworth | 48087 | 2025 | 1.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Colorado | 48089 | 2025 | 10.9 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-03 |  |
| Comal | 48091 | 2025 | 61.2 MB | 83% | 100% | 100% | 90% | 100% | 100% | 2026-02 |  |
| Comanche | 48093 | 2025 | 9.7 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Concho | 48095 | 2025 | 3.3 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Cooke | 48097 | 2025 | 17.8 MB | 92% | 100% | 100% | 100% | 100% | 0% | 2026-06 |  |
| Coryell | 48099 | 2025 | 16.7 MB | 83% | 90% | 100% | 90% | 90% | 100% | 2026-03 |  |
| Cottle | 48101 | 2025 | 1.7 MB | 100% | 83% | 100% | 0% | 83% | 100% | 2026-06 |  |
| Crane | 48103 | 2025 | 1.8 MB | 92% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Crockett | 48105 | 2025 | 2.6 MB | 100% | 17% | 100% | 17% | 17% | 100% | 2026-06 | NO OWNER |
| Crosby | 48107 | 2025 | 2.1 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Culberson | 48109 | 2025 | 3.1 MB | 92% | 100% | 100% | 0% | 100% | 100% | 2025-05 |  |
| Dallam | 48111 | 2025 | 2.6 MB | 100% | 100% | 100% | 58% | 100% | 100% | 2026-03 |  |
| Dallas | 48113 | 2025 | 276.8 MB | 92% | 100% | 100% | 100% | 0% | 0% | 2026-08 |  |
| Dawson | 48115 | 2025 | 3.2 MB | 100% | 83% | 100% | 83% | 83% | 100% | 2025-05 |  |
| Deaf Smith | 48117 | 2025 | 4.8 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Delta | 48119 | 2025 | 9.0 MB | 100% | 92% | 100% | 67% | 92% | 100% | 2026-03 |  |
| Denton | 48121 | 2025 | 166.9 MB | 92% | 100% | 100% | 91% | 100% | 100% | 2026-07 |  |
| DeWitt | 48123 | 2025 | 27.1 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-06 |  |
| Dickens | 48125 | 2025 | 1.4 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-06 |  |
| Dimmit | 48127 | 2025 | 5.6 MB | 100% | 75% | 100% | 17% | 75% | 100% | 2026-03 |  |
| Duval | 48131 | 2025 | 6.1 MB | 100% | 100% | 100% | 33% | 100% | 100% | 2026-03 |  |
| Eastland | 48133 | 2025 | 7.7 MB | 92% | 82% | 100% | 64% | 0% | 100% | 2026-03 |  |
| Ector | 48135 | 2025 | 33.6 MB | 100% | 100% | 100% | 100% | 92% | 100% | 2026-07 |  |
| Edwards | 48137 | 2025 | 7.0 MB | 92% | 100% | 100% | 27% | 100% | 100% | 2026-03 |  |
| El Paso | 48141 | 2025 | 191.6 MB | 67% | 100% | 100% | 100% | 100% | 100% | 2026-03 | LOW HIT |
| Ellis | 48139 | 2025 | 52.2 MB | 92% | 100% | 100% | 100% | 100% | 0% | 2026-07 |  |
| Erath | 48143 | 2025 | 12.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Falls | 48145 | 2025 | 10.7 MB | 100% | 100% | 100% | 92% | 100% | 100% | 2026-03 |  |
| Fannin | 48147 | 2025 | 15.8 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Fayette | 48149 | 2025 | 13.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Fisher | 48151 | 2025 | 2.7 MB | 100% | 92% | 100% | 17% | 92% | 100% | 2026-06 |  |
| Floyd | 48153 | 2025 | 3.5 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-09 |  |
| Foard | 48155 | 2025 | 1.6 MB | 100% | 83% | 100% | 17% | 83% | 100% | 2026-06 |  |
| Fort Bend | 48157 | 2025 | 200.8 MB | 100% | 92% | 100% | 92% | 17% | 100% | 2026-03 |  |
| Franklin | 48159 | 2025 | 7.7 MB | 92% | 100% | 100% | 45% | 100% | 100% | 2026-03 |  |
| Freestone | 48161 | 2025 | 9.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Frio | 48163 | 2025 | 4.3 MB | 100% | 75% | 100% | 75% | 75% | 100% | 2026-06 |  |
| Gaines | 48165 | 2025 | 6.8 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Galveston | 48167 | 2025 | 73.8 MB | 50% | 100% | 100% | 83% | 100% | 0% | 2026-07 | LOW HIT |
| Garza | 48169 | 2025 | 2.9 MB | 100% | 92% | 100% | 92% | 0% | 100% | 2026-03 |  |
| Gillespie | 48171 | 2025 | 39.1 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-02 |  |
| Glasscock | 48173 | 2025 | 1.0 MB | 100% | 92% | 100% | 58% | 92% | 100% | 2026-06 |  |
| Goliad | 48175 | 2025 | 5.5 MB | 100% | 67% | 100% | 58% | 67% | 100% | 2026-06 |  |
| Gonzales | 48177 | 2025 | 7.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Gray | 48179 | 2025 | 5.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Grayson | 48181 | 2025 | 39.9 MB | 92% | 100% | 100% | 100% | 100% | 0% | 2026-03 |  |
| Gregg | 48183 | 2025 | 37.0 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Grimes | 48185 | 2025 | 11.9 MB | 92% | 100% | 100% | 55% | 27% | 100% | 2026-03 |  |
| Guadalupe | 48187 | 2025 | 46.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Hale | 48189 | 2025 | 12.0 MB | 83% | 100% | 100% | 10% | 100% | 100% | 2026-03 |  |
| Hall | 48191 | 2025 | 2.1 MB | 100% | 92% | 100% | 33% | 92% | 100% | 2026-06 |  |
| Hamilton | 48193 | 2025 | 8.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Hansford | 48195 | 2025 | 2.1 MB | 92% | 91% | 100% | 18% | 91% | 100% | 2026-06 |  |
| Hardeman | 48197 | 2025 | 2.2 MB | 100% | 100% | 100% | 17% | 100% | 100% | 2026-06 |  |
| Hardin | 48199 | 2025 | 16.2 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Harris | 48201 | 2025 | 479.5 MB | 100% | 100% | 100% | 100% | 0% | 0% | 2026-08 |  |
| Harrison | 48203 | 2025 | 23.6 MB | 83% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Hartley | 48205 | 2025 | 2.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Haskell | 48207 | 2025 | 3.9 MB | 100% | 100% | 100% | 25% | 100% | 100% | 2026-06 |  |
| Hays | 48209 | 2025 | 67.0 MB | 100% | 92% | 100% | 92% | 25% | 100% | 2026-02 |  |
| Hemphill | 48211 | 2025 | 1.6 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Henderson | 48213 | 2025 | 42.3 MB | 100% | 100% | 100% | 83% | 100% | 100% | 2026-03 |  |
| Hidalgo | 48215 | 2025 | 140.3 MB | 83% | 100% | 100% | 100% | 100% | 0% | 2026-07 |  |
| Hill | 48217 | 2025 | 19.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Hockley | 48219 | 2025 | 7.3 MB | 100% | 92% | 100% | 8% | 92% | 100% | 2026-03 |  |
| Hood | 48221 | 2025 | 28.6 MB | 75% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Hopkins | 48223 | 2025 | 16.3 MB | 92% | 100% | 100% | 0% | 100% | 100% | 2026-09 |  |
| Houston | 48225 | 2025 | 10.7 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-07 |  |
| Howard | 48227 | 2025 | 8.1 MB | 100% | 83% | 100% | 0% | 83% | 100% | 2026-03 |  |
| Hudspeth | 48229 | 2025 | 7.6 MB | 100% | 83% | 100% | 8% | 83% | 100% | 2026-03 |  |
| Hunt | 48231 | 2025 | 36.8 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-09 |  |
| Hutchinson | 48233 | 2025 | 5.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Irion | 48235 | 2025 | 1.2 MB | 100% | 92% | 100% | 0% | 92% | 100% | 2026-06 |  |
| Jack | 48237 | 2025 | 4.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Jackson | 48239 | 2025 | 8.5 MB | 92% | 100% | 100% | 100% | 0% | 100% | 2026-03 |  |
| Jasper | 48241 | 2025 | 18.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Jeff Davis | 48243 | 2025 | 2.2 MB | 100% | 83% | 100% | 0% | 83% | 100% | 2026-06 |  |
| Jefferson | 48245 | 2025 | 68.4 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-09 |  |
| Jim Hogg | 48247 | 2025 | 1.4 MB | 100% | 67% | 100% | 25% | 67% | 100% | 2026-06 |  |
| Jim Wells | 48249 | 2025 | 10.9 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-03 |  |
| Johnson | 48251 | 2025 | 39.8 MB | 100% | 100% | 0% | 100% | 100% | 100% | 2026-08 | NO MAIL |
| Jones | 48253 | 2025 | 10.4 MB | 100% | 92% | 100% | 67% | 92% | 100% | 2026-06 |  |
| Karnes | 48255 | 2025 | 5.3 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Kaufman | 48257 | 2025 | 42.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Kendall | 48259 | 2025 | 21.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-02 |  |
| Kenedy | 48261 | 2025 | 0.3 MB | 75% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Kent | 48263 | 2025 | 1.2 MB | 100% | 92% | 100% | 0% | 92% | 100% | 2026-06 |  |
| Kerr | 48265 | 2025 | 18.6 MB | 100% | 100% | 100% | 75% | 100% | 100% | 2026-02 |  |
| Kimble | 48267 | 2025 | 6.7 MB | 100% | 100% | 100% | 33% | 100% | 100% | 2026-02 |  |
| King | 48269 | 2025 | 0.7 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Kinney | 48271 | 2025 | 5.0 MB | 100% | 100% | 100% | 42% | 100% | 100% | 2026-03 |  |
| Kleberg | 48273 | 2025 | 8.0 MB | 83% | 100% | 100% | 100% | 100% | 50% | 2026-07 |  |
| Knox | 48275 | 2025 | 3.3 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| La Salle | 48283 | 2025 | 5.1 MB | 92% | 100% | 100% | 45% | 100% | 100% | 2026-03 |  |
| Lamar | 48277 | 2025 | 19.1 MB | 100% | 100% | 100% | 67% | 100% | 100% | 2026-03 |  |
| Lamb | 48279 | 2025 | 5.3 MB | 100% | 100% | 100% | 50% | 100% | 100% | 2026-03 |  |
| Lampasas | 48281 | 2025 | 7.6 MB | 100% | 50% | 100% | 50% | 50% | 100% | 2026-03 |  |
| Lavaca | 48285 | 2025 | 10.1 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Lee | 48287 | 2025 | 9.1 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Leon | 48289 | 2025 | 11.2 MB | 100% | 83% | 100% | 67% | 83% | 100% | 2026-06 |  |
| Liberty | 48291 | 2025 | 59.4 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Limestone | 48293 | 2025 | 10.6 MB | 92% | 100% | 100% | 100% | 100% | 18% | 2026-07 |  |
| Lipscomb | 48295 | 2025 | 2.7 MB | 100% | 100% | 100% | 0% | 92% | 100% | 2026-09 |  |
| Live Oak | 48297 | 2025 | 7.0 MB | 100% | 92% | 100% | 92% | 0% | 100% | 2026-06 |  |
| Llano | 48299 | 2025 | 23.7 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Loving | 48301 | 2025 | 0.7 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Lubbock | 48303 | 2025 | 57.8 MB | 92% | 100% | 100% | 55% | 100% | 0% | 2026-07 |  |
| Lynn | 48305 | 2025 | 2.3 MB | 100% | 83% | 100% | 58% | 83% | 100% | 2026-06 |  |
| Madison | 48313 | 2025 | 5.3 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Marion | 48315 | 2025 | 9.2 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Martin | 48317 | 2025 | 2.1 MB | 100% | 100% | 100% | 25% | 100% | 100% | 2026-06 |  |
| Mason | 48319 | 2025 | 4.3 MB | 100% | 83% | 100% | 8% | 83% | 100% | 2026-03 |  |
| Matagorda | 48321 | 2025 | 18.9 MB | 58% | 86% | 57% | 86% | 86% | 100% | 2026-09 | LOW HIT |
| Maverick | 48323 | 2025 | 10.4 MB | 92% | 100% | 100% | 100% | 100% | 9% | 2026-07 |  |
| McCulloch | 48307 | 2025 | 3.7 MB | 100% | 100% | 100% | 17% | 100% | 100% | 2026-06 |  |
| McLennan | 48309 | 2025 | 59.7 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-09 |  |
| McMullen | 48311 | 2025 | 2.2 MB | 100% | 83% | 100% | 58% | 83% | 100% | 2026-03 |  |
| Medina | 48325 | 2025 | 18.4 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-03 |  |
| Menard | 48327 | 2025 | 2.0 MB | 100% | 100% | 100% | 42% | 100% | 100% | 2026-06 |  |
| Midland | 48329 | 2025 | 29.2 MB | 100% | 100% | 100% | 92% | 100% | 100% | 2026-08 |  |
| Milam | 48331 | 2025 | 15.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Mills | 48333 | 2025 | 4.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Mitchell | 48335 | 2025 | 3.0 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Montague | 48337 | 2025 | 8.5 MB | 100% | 75% | 0% | 0% | 0% | 100% | 2026-07 | NO MAIL |
| Montgomery | 48339 | 2025 | 194.3 MB | 100% | 100% | 100% | 100% | 92% | 0% | 2026-07 |  |
| Moore | 48341 | 2025 | 4.8 MB | 92% | 100% | 100% | 91% | 100% | 100% | 2026-03 |  |
| Morris | 48343 | 2025 | 5.5 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-06 |  |
| Motley | 48345 | 2025 | 2.1 MB | 100% | 92% | 100% | 8% | 92% | 100% | 2026-08 |  |
| Nacogdoches | 48347 | 2025 | 22.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-09 |  |
| Navarro | 48349 | 2025 | 27.1 MB | 100% | 100% | 100% | 42% | 0% | 100% | 2026-09 |  |
| Newton | 48351 | 2025 | 14.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Nolan | 48353 | 2025 | 4.5 MB | 92% | 91% | 100% | 91% | 91% | 100% | 2026-06 |  |
| Nueces | 48355 | 2025 | 85.3 MB | 58% | 100% | 100% | 100% | 100% | 100% | 2026-07 | LOW HIT |
| Ochiltree | 48357 | 2025 | 2.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Oldham | 48359 | 2025 | 1.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Orange | 48361 | 2025 | 24.7 MB | 83% | 100% | 100% | 70% | 10% | 100% | 2026-03 |  |
| Palo Pinto | 48363 | 2025 | 16.0 MB | 100% | 58% | 100% | 92% | 58% | 100% | 2026-09 |  |
| Panola | 48365 | 2025 | 7.5 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-06 |  |
| Parker | 48367 | 2025 | 50.0 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Parmer | 48369 | 2025 | 3.0 MB | 100% | 92% | 100% | 25% | 92% | 100% | 2026-03 |  |
| Pecos | 48371 | 2025 | 4.0 MB | 100% | 100% | 100% | 8% | 100% | 100% | 2026-06 |  |
| Polk | 48373 | 2025 | 31.7 MB | 100% | 100% | 92% | 100% | 100% | 100% | 2026-03 |  |
| Potter | 48375 | 2025 | 16.9 MB | 92% | 100% | 100% | 100% | 0% | 0% | 2026-08 |  |
| Presidio | 48377 | 2025 | 6.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Rains | 48379 | 2025 | 4.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Randall | 48381 | 2025 | 21.4 MB | 100% | 100% | 100% | 100% | 0% | 0% | 2026-08 |  |
| Reagan | 48383 | 2025 | 1.3 MB | 100% | 100% | 100% | 8% | 100% | 100% | 2026-06 |  |
| Real | 48385 | 2025 | 4.3 MB | 100% | 92% | 100% | 42% | 92% | 100% | 2026-03 |  |
| Red River | 48387 | 2025 | 6.4 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-06 |  |
| Reeves | 48389 | 2025 | 6.1 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-07 |  |
| Refugio | 48391 | 2025 | 4.9 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Roberts | 48393 | 2025 | 1.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-09 |  |
| Robertson | 48395 | 2025 | 7.7 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-03 |  |
| Rockwall | 48397 | 2025 | 34.5 MB | 75% | 100% | 100% | 100% | 100% | 0% | 2026-07 |  |
| Runnels | 48399 | 2025 | 5.4 MB | 100% | 100% | 100% | 0% | 0% | 100% | 2026-09 |  |
| Rusk | 48401 | 2025 | 15.5 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Sabine | 48403 | 2025 | 9.4 MB | 100% | 75% | 100% | 100% | 75% | 100% | 2026-09 |  |
| San Augustine | 48405 | 2025 | 5.3 MB | 83% | 80% | 100% | 0% | 80% | 100% | 2026-06 |  |
| San Jacinto | 48407 | 2025 | 19.8 MB | 67% | 100% | 100% | 100% | 100% | 100% | 2026-03 | LOW HIT |
| San Patricio | 48409 | 2025 | 20.2 MB | 100% | 92% | 100% | 83% | 92% | 100% | 2026-03 |  |
| San Saba | 48411 | 2025 | 4.7 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-05 |  |
| Schleicher | 48413 | 2025 | 2.3 MB | 100% | 92% | 100% | 25% | 92% | 100% | 2026-03 |  |
| Scurry | 48415 | 2025 | 5.7 MB | 100% | 100% | 100% | 33% | 100% | 100% | 2026-03 |  |
| Shackelford | 48417 | 2025 | 5.1 MB | 100% | 100% | 100% | 8% | 100% | 100% | 2026-03 |  |
| Shelby | 48419 | 2025 | 10.1 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-03 |  |
| Sherman | 48421 | 2025 | 1.2 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-06 |  |
| Smith | 48423 | 2025 | 70.2 MB | 100% | 0% | 0% | 100% | 0% | 0% | 2026-07 | NO OWNER, NO MAIL |
| Somervell | 48425 | 2025 | 5.1 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-09 |  |
| Starr | 48427 | 2025 | 16.9 MB | 100% | 83% | 100% | 50% | 83% | 100% | 2026-03 |  |
| Stephens | 48429 | 2025 | 5.0 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Sterling | 48431 | 2025 | 0.8 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Stonewall | 48433 | 2025 | 1.6 MB | 100% | 92% | 100% | 17% | 92% | 100% | 2026-06 |  |
| Sutton | 48435 | 2025 | 3.0 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-02 |  |
| Swisher | 48437 | 2025 | 2.7 MB | 92% | 100% | 100% | 36% | 100% | 100% | 2026-03 |  |
| Tarrant | 48439 | 2025 | 319.8 MB | 92% | 100% | 100% | 91% | 100% | 9% | 2026-08 |  |
| Taylor | 48441 | 2025 | 37.9 MB | 100% | 100% | 100% | 67% | 100% | 100% | 2026-07 |  |
| Terrell | 48443 | 2025 | 4.1 MB | 100% | 100% | 83% | 0% | 100% | 100% | 2026-09 |  |
| Terry | 48445 | 2025 | 3.1 MB | 100% | 100% | 100% | 100% | 0% | 100% | 2026-07 |  |
| Throckmorton | 48447 | 2025 | 1.4 MB | 100% | 100% | 100% | 0% | 100% | 100% | 2026-06 |  |
| Titus | 48449 | 2025 | 12.4 MB | 92% | 100% | 100% | 91% | 100% | 100% | 2026-03 |  |
| Tom Green | 48451 | 2025 | 24.3 MB | 100% | 100% | 100% | 100% | 92% | 100% | 2026-03 |  |
| Travis | 48453 | 2025 | 344.3 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-07 |  |
| Trinity | 48455 | 2025 | 13.6 MB | 100% | 100% | 100% | 58% | 100% | 100% | 2026-03 |  |
| Tyler | 48457 | 2025 | 13.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Upshur | 48459 | 2025 | 16.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Upton | 48461 | 2025 | 2.1 MB | 100% | 100% | 100% | 17% | 100% | 100% | 2026-06 |  |
| Uvalde | 48463 | 2025 | 12.1 MB | 100% | 100% | 100% | 83% | 100% | 100% | 2026-07 |  |
| Val Verde | 48465 | 2025 | 18.6 MB | 100% | 100% | 100% | 100% | 100% | 0% | 2026-07 |  |
| Van Zandt | 48467 | 2025 | 20.0 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Victoria | 48469 | 2025 | 21.8 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-07 |  |
| Walker | 48471 | 2025 | 28.8 MB | 92% | 100% | 100% | 82% | 100% | 100% | 2026-07 |  |
| Waller | 48473 | 2025 | 21.7 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Ward | 48475 | 2025 | 4.5 MB | 100% | 100% | 100% | 17% | 100% | 100% | 2026-05 |  |
| Washington | 48477 | 2025 | 12.7 MB | 100% | 100% | 100% | 92% | 100% | 100% | 2026-03 |  |
| Webb | 48479 | 2025 | 42.6 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-08 |  |
| Wharton | 48481 | 2025 | 12.8 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Wheeler | 48483 | 2025 | 2.4 MB | 100% | 100% | 100% | 50% | 100% | 100% | 2026-06 |  |
| Wichita | 48485 | 2025 | 28.9 MB | 92% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Wilbarger | 48487 | 2025 | 4.9 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Willacy | 48489 | 2025 | 7.6 MB | 100% | 50% | 42% | 0% | 50% | 100% | 2026-09 |  |
| Williamson | 48491 | 2025 | 126.2 MB | 92% | 100% | 100% | 100% | 91% | 0% | 2026-07 |  |
| Wilson | 48493 | 2025 | 22.7 MB | 100% | 100% | 100% | 92% | 100% | 100% | 2026-03 |  |
| Winkler | 48495 | 2025 | 2.6 MB | 100% | 92% | 100% | 100% | 0% | 0% | 2026-07 |  |
| Wise | 48497 | 2025 | 21.0 MB | 92% | 82% | 100% | 73% | 82% | 100% | 2026-03 |  |
| Wood | 48499 | 2025 | 21.7 MB | 83% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |
| Yoakum | 48501 | 2025 | 2.7 MB | 100% | 100% | 100% | 83% | 100% | 100% | 2026-03 |  |
| Young | 48503 | 2025 | 7.8 MB | 100% | 92% | 100% | 92% | 92% | 100% | 2026-03 |  |
| Zapata | 48505 | 2025 | 5.3 MB | 100% | 100% | 100% | 8% | 100% | 100% | 2026-03 |  |
| Zavala | 48507 | 2025 | 4.8 MB | 100% | 100% | 100% | 100% | 100% | 100% | 2026-03 |  |

## 9. Method notes and limits

- County outlines: Census TIGERweb (254 Texas counties). Points were chosen uniformly at random inside each county.
- The service answers "identify" queries only at a fairly close map scale, so each sample point was queried with a small map window; water, roads and unparcelled land return no parcel and lower the hit rate.
- 12-point samples are rough: a county at 83% may truly be anywhere from 55% to 100%. Deep samples (200 points) are much tighter.
- Land-use emptiness was confirmed in 7 counties with a second, 60-point sample on both land-use fields.
- Scripts used live in the scratchpad only; they are not part of the app.
