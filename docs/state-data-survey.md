# 50-State Survey: Free Official Statewide Parcel Data (2026-11-10)

**Purpose:** find which states publish a FREE, OFFICIAL, statewide parcel dataset (with owner and mailing address) that Land Oracle could load, versus data that exists only county by county.

**How this was made:** five parallel web-research passes (about ten states each), then compiled here. It is desk research from agency pages, ArcGIS service metadata and search results. **Nothing here has been downloaded or tested.** Anything marked UNVERIFIED was not confirmed on an official page. Statutes are cited as the researchers found them; none is legal advice. Several agency pages returned 403/404 to the researchers, so "not found" means "not found by this survey", not "does not exist". Third-party sellers (Regrid, Land Records, ReportAll, ...) are mentioned only as notes: they are not free official sources.

Confidence key: H = read the official page or live service; M = official snippet or partial read; L = inferred or secondhand.

---

## 0. Deep dive: seven states (2026-11-25)

**Scope:** Tennessee, Arkansas, Wisconsin, Utah, Montana, Indiana and Kentucky, each checked for a free statewide parcel download that carries owner name AND owner mailing address, and for terms that allow commercial use and display in a paid SaaS. Ranked from easiest to hardest to load. This section follows up the 50-state table below (which it largely confirms) and is more detailed than it.

**How this was made:** one research pass per state, reading agency documentation, schema PDFs and ArcGIS service field lists. **No dataset was downloaded, no county site was queried or scripted, no REST endpoint was asked for records, and nothing was signed up for.** Where a page would not load, that is stated; "not stated" means the page does not say, not that the answer is no. These are desk findings from the researchers' reads of the pages; none of it has been loaded or tested here, and it is not legal advice.

### Ranking (easiest to load first)

"Load effort" is the technical work. The last column says whether the state's data can be used as it stands for what Land Oracle needs: owner name, owner mailing address (for postcards), acreage, land use and value.

| # | State | Free statewide file? | Owner name | Owner mailing | Acres / class / value | Load effort | Usable as-is for owner mailing? |
|---|---|---|---|---|---|---|---|
| 1 | **Wisconsin** | **Yes**, one 1.6 GB file geodatabase, 3.56M parcels, 72 counties | Yes (some redactions) | Yes (`PSTLADRESS`) | Yes / yes / yes | Easy to medium | **Yes, after written OK on license** |
| 2 | **Arkansas** | Yes, 73 of 75 counties listed (download route unconfirmed) | Yes | **No** (situs only) | **No acreage field** / yes / yes | Medium | No: no mailing address |
| 3 | **Montana** | Yes, monthly, per county (56 files) | Yes | Yes | Yes / yes / yes | Easy to medium | **No: state mailing-list law, needs legal sign-off** |
| 4 | **Indiana** | Parcel shapes yes; owner data no | **No** (not in the layer) | **No** | No acreage field / class only / no value | Medium to hard | No: owners would need a separate state file, unverified |
| 5 | **Tennessee** | **No**: per-county request forms, 86 counties, 9 largest excluded | Probably (unconfirmed) | Unconfirmed | Unconfirmed field names | Hard | Not until fields are confirmed; manual per county |
| 6 | **Utah** | Parcels yes (services, no bulk file) | **No** | **No** | Yes / yes / market value | Medium for shapes; owners impossible from state data | No: owner data is excluded by design |
| 7 | **Kentucky** | **No free statewide source found** | Sold, not free | Sparse | Sparse | Hardest | No |

**Bottom line:** only **Wisconsin** gives us a free, statewide, single-file source with every field we need. **Montana** has every field too but the owner data is legally restricted for mailing use. Arkansas is the cheapest second source but has no mailing address and no acreage field. Indiana, Utah and Kentucky give shapes at best (Kentucky not even that), and Tennessee is free but manual.

### 1. Wisconsin

- **Who and where:** State Cartographer's Office with the Wisconsin Land Information Program, Statewide Parcel Map Initiative: https://www.sco.wisc.edu/parcels/data . Page says "provided free of charge"; no registration stated. Also an ArcGIS feature service (Wisconsin_Statewide_Parcels_DB on services3.arcgis.com).
- **Format and size:** file geodatabase ZIP, **V12 = 3.56M records, 1.6 GB**. County downloads (.gdb or .shp) on a separate page. No CSV. Needs GDAL/ogr2ogr to read a file geodatabase.
- **Owner and mailing:** `OWNERNME1`, `OWNERNME2` (owner names), `PSTLADRESS` ("Full Mailing Address (Owner)"). Counties and cities may opt out: **Kenosha 100% of owner names redacted**; partial: Dane 11.43%, Barron 0.59%, Vilas 0.51%, Columbia 0.46%, Manitowoc 0.31%, Sheboygan 0.22%, Brown 0.18%, Crawford 0.11%. Redacted names read "NOT AVAILABLE". Whether `PSTLADRESS` is also blanked for those: not stated. 2023 Act 235 (effective April 1, 2025) lets judicial officers shield their names, so more redaction is possible in later releases.
- **Acreage, class, value:** `ASSDACRES` (assessed), `DEEDACRES`, `GISACRES`; `PROPCLASS`, `AUXCLASS`; `CNTASSDVALUE` (total assessed), `LNDVALUE`, `IMPVALUE`, `ESTFMKVALUE` (estimated fair market, nulled for several classes), tax fields. No sale price or date.
- **Updates:** annual. V12.0.0 is latest (polygons collected January to May 2026, tax roll mostly 2025). V13 tentatively June 30, 2027.
- **License:** **no license or commercial-use clause found.** The page only says no warranty is made and that boundaries are not legal boundaries. Commercial use, SaaS display and redistribution: not stated. **Ask the State Cartographer's Office in writing.**
- **Coverage:** all 72 counties are in the schema. Two have gaps: Buffalo (parts of the city of Buffalo and the town of Milton) and Burnett (about five towns partial).
- **Surprises:** about a year of tax-roll lag; many NULLs; gaps and overlaps at jurisdiction edges.
- **Verdict:** easy to medium. The best candidate.

### 2. Arkansas

- **Who and where:** Arkansas GIS Office (AGISO), "Parcel Polygon - County Assessor Mapping Program" (PARCEL_POLYGON_CAMP), plus a centroid layer. Metadata: http://gis.arkansas.gov/Metadata/HTML/asdi.Planning_Cadastre.PARCEL_POLYGON_CAMP_export.html . **The old gis.arkansas.gov pages now redirect to a JavaScript hub (geodata.gis.arkansas.gov) that could not be read**, so the download page, format and file size are **unconfirmed**. Search results point to a product page, an old statewide FTP folder and an ArcGIS REST service. No fee is mentioned in the metadata.
- **Format and size:** not stated (file geodatabase and shapefile appear in older posts).
- **Owner and mailing:** `OwnerName` yes. **No owner mailing address**: the only address fields are the parcel's own situs address (`AdrNum`, `PstrNam`, `AdrCity`, `AdrZip5` and so on).
- **Acreage, class, value:** **no acreage field** (`TaxArea` is "Area Used for Taxation/Assessment Purposes", unit not stated; otherwise compute from the polygon area). `ParcelType` is the property type code. Values: `AssessValue`, `ImpValue`, `LandValue`, `TotalValue`. Joined to county CAMA data (`CAMAKey`, `CAMADate`).
- **Updates:** semi-annual, with county updates throughout the year. Newest post reportedly says 74 counties.
- **License:** "may be downloaded and utilized in any manner", provided "as is" without warranty, not a legal boundary (Arkansas Law 15-21-504). No stated restriction on commercial use, redistribution or mailing lists. A separate terms page may exist and was not found.
- **Coverage:** **not fully statewide.** The metadata lists 73 counties (Fulton and Searcy missing against the 75) and warns "just because a county is listed does NOT imply the data represents county wide coverage."
- **Verdict:** medium. Cheap and permissive, but needs a mailing-address source for postcards and a browser visit to confirm the download link.

### 3. Montana

- **Who and where:** Montana State Library with the Department of Revenue (DOR maintains most counties; Ravalli, Silver Bow, Missoula, Flathead and Yellowstone maintain their own): https://msl.mt.gov/geoinfo/msdi/cadastral/ . Download link points to an FTP directory (https://ftpgeoinfo.msl.mt.gov/Data/Spatial/MSDI/Cadastral/Parcels), not opened.
- **Format and size:** "monthly for each Montana county in file geodatabase and shapefile". **Per county, not one statewide file** (56 files to merge). Size: not stated.
- **Owner and mailing:** both, in the one parcel layer: `OwnerName`, `OwnerAddress1`, `OwnerAddress2`, `OwnerAddress3`, `OwnerCity`, `OwnerState`, `OwnerZipCode`, plus `DbaName`, `CareOfTaxpayer`. Owners can file a DOR nondisclosure request (those names may be blank).
- **Acreage, class, value:** `GISAcres`, `TotalAcres`, plus split agricultural acres; `PropType`; `TotalLandValue`, `TotalBuildingValue`, `TotalValue`; `TaxYear`, township/range/section, legal description.
- **Updates:** monthly per county. Latest date: not stated.
- **License and the mailing-list law (the blocker):** the service's license text quotes **Montana Code Annotated 2-6-1017**: public agencies may not distribute or sell a distribution list without the permission of those on the list, and a list of persons prepared by a public agency may not be used as a distribution list without that permission "except by that agency". It adds that "State law does not prevent an individual from compiling a distribution list by examination of records that are otherwise open to public inspection." Other State Library metadata cites the older 2-6-109(1) and calls mailing-list use "a punishable offense"; the penalty is not stated on the pages read, and no permission mechanism other than each person's consent was found. **Commercial and SaaS use: not stated.** Loading owner names and addresses into a tool that sends postcards to them is very likely "distribution list" use. **Treat as a legal blocker until a lawyer clears it.**
- **Coverage:** "most of Montana"; not stated as all 56 counties; missing counties not named.
- **Suggested path:** load parcel shapes, acreage, type and value; keep owner fields out until the State Library or DOR confirms in writing that our use is allowed, or get owner contact data another way (for example a skip-trace vendor).
- **Verdict:** technically easy to medium, legally hard for owner data.

### 4. Indiana

- **Who and where:** Indiana Geographic Information Office (IGIO), Data Harvest and IndianaMap: "Parcel Boundaries of Indiana 2025" and a Current layer. The Data Harvest "Data Access" page loaded as an empty shell, so the zipped-download links are unconfirmed. Free per the Data Gallery.
- **Format and size:** ArcGIS feature service (2,000-record pages) plus zipped files; Data Gallery exports shapefile, CSV, GeoJSON, KML. 3,677,250 parcels collected in 2024. File size: not stated.
- **Owner and mailing:** **not in the layer.** The full field list has parcel IDs, situs address, DLGF class code, county codes and tax districts, and **no owner field of any kind**. Owner data would come from the Department of Local Government Finance (DLGF) statewide real property files at gateway.ifionline.org/public/download.aspx ("Real Property", by tax-bill year, by county or all counties). Whether those public files contain owner name and mailing address, their format and their terms: **not stated, unverified.** Join key looks like `state_parcel_id` or `parcel_id`, untested.
- **Acreage, class, value:** class `dlgf_prop_class_code`; **no acreage field** (compute from shape area); assessed value not in the layer.
- **Updates:** annual (Data Harvest 2025 is latest).
- **License:** **not stated** on any IGIO page or layer metadata (copyright text empty). Third-party sources say CC0 (unverified); some individual datasets carry their own agreements, and the general State of Indiana data portal terms are non-commercial. Ask IGIO (DataHarvest@iot.in.gov) and DLGF Gateway.
- **Coverage:** not stated (28 of 92 counties submitted themselves in 2024; the Polis Center handled the other 64, a processing split rather than a coverage statement).
- **Verdict:** parcel shapes easy to medium; owner and mailing hard (separate file, unverified). Commercial-purpose language also exists in Indiana law (IC 5-14-3-3(f)); its scope for owner lists is unverified.

### 5. Tennessee

- **Who and where:** Tennessee Comptroller, Geographic Services: https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps/parcel-data.html . Data is "extracted directly from our CAMA system and are public records." Contact GIS.Data@cot.tn.gov.
- **How you get it:** **a request form per county**, after which download links open. The page says the office does "not offer bulk or historical downloads, recurring extracts, or automated downloads." No fee mentioned. No statewide file.
- **Format and size:** one Esri shapefile per county; owner and assessment data in a separate `Assessment_Data_##.dbf` that joins on `GISLINK`. Size: not stated.
- **Owner and mailing:** the joined table carries "owner, property, building, land use, and assessment information"; mailing address is not named. A field dictionary exists only as an Excel file inside each county's download, so field names are **unconfirmed**.
- **Updates:** weekly (typically Mondays). Land-use product quarterly.
- **License:** "any organization may use, save and maintain the shapefile data for any purpose, including commercial use." Approximate, for tax purposes only, not legal boundaries. Redistribution, paid-SaaS display and mailing-list limits: not stated.
- **Coverage:** **not statewide.** The Comptroller does not distribute **9 counties**: Chester, Davidson (Nashville), Hamilton, Hickman, Knox, Montgomery, Rutherford, Shelby (Memphis) and Williamson. The biggest metros must come from their own assessors.
- **Verdict:** hard. Free and commercial use is allowed, but it is 86 manual requests, repeated for every refresh, with the nine largest counties missing and the key fields unconfirmed. A small county request would settle the field list cheaply.

### 6. Utah

- **Who and where:** Utah Geospatial Resource Center (UGRC, formerly AGRC), SGID: https://gis.utah.gov/data/cadastre/parcels says "no direct file downloads". Access is per-county open-data pages and ArcGIS feature services (basic and "LIR" parcels), a statewide parcel service, vector tiles, an "LIR parcel archive on Google Drive" and Open SGID SQL.
- **Format and size:** feature services (LIR max 2,000 records per request); size not stated.
- **Owner and mailing:** **not in the statewide parcels.** Only a generalized `OWN_TYPE` (Federal, Private, State, Tribal). A 2016 post says personally identifiable information is avoided by design. A separate government-owned parcels layer has an owner name, but only for government land. County-held owner data is sold separately (Washington County: owner name and mailing sold by its IT services, $500 initial and $100 per update) or requested under GRAMA (Utah Code 63G-2).
- **Acreage, class, value:** `PARCEL_ACRES`, `PROP_CLASS`, `TOTAL_MKT_VALUE`, `LAND_MKT_VALUE` (**market value; no assessed-value field**), plus building and tax fields.
- **Updates:** the five biggest counties targeted monthly; rural quarterly to annual; LIR annually with the tax roll.
- **License:** "There are no constraints or warranties", attribution encouraged. Commercial use and SaaS display not explicitly addressed. Treat as permissive and confirm if you want it in writing.
- **Coverage:** all 29 counties listed, "some counties are more complete than others"; LIR available for "most counties"; some stale entries (Sanpete basic 2015, Box Elder LIR 2020).
- **Verdict:** medium for shapes, acreage and value; **owner and mailing cannot come from the state**, so 29 county negotiations. Hard for an owner-contact product.

### 7. Kentucky

- **Who and where:** **no free statewide parcel download found.** Kentucky property is assessed by 120 county Property Valuation Administrators (PVAs) under the Department of Revenue. The DOR mapping page says "The department sells GIS data products" and that requests "should first be made with the local PVA office in person or by telephone." The researcher could not read the KYGeoportal or KYGIS catalogs, so "not found" is **absence of evidence, not proof**.
- **Cost:** DOR page lists a **$50 request fee for GIS digital data** and **$0.30 per parcel without ownership records, $0.40 per parcel with ownership records**. At roughly 2.4 million parcels that is on the order of $1 million, so not a realistic route. Format not stated.
- **Free county layers:** Jefferson County (Louisville), published by the PVA through LOJIC, is free and updated daily (REST, CSV, GeoJSON, KML, shapefile); its field list was not readable and whether it carries owner fields is unconfirmed. Fayette and Scott are reported as largely free; most counties need a subscription (qPublic or PVA sites). No count of free counties.
- **Owner and mailing (aggregator figures, not official):** one commercial aggregator shows owner name about 94% populated and **owner mailing address only about 39%**; acreage about 60%, use code about 45%, total value about 61%.
- **License and law:** KRS 133.047 makes PVA records subject to the open-records law (KRS 61.870 to 61.884) and lets the DOR set commercial-purpose fees. KRS 61.870(4) defines commercial purpose as use "for sale, resale, solicitation, rent, or lease of a service, or any use by which the user expects a profit." Attorney General decisions found through search snippets treated a sorted owner mailing-list request (02-ORD-89, Jefferson PVA) and publishing ownership data on a website (14-ORD-125) as commercial. A paid SaaS is almost certainly "commercial purpose": higher fees and possibly a stated purpose. A flat ban on commercial lists was **not** confirmed; the statute text was unreadable, so counsel should read KRS 61.874(4).
- **Note on the earlier survey:** the table below says "108 counties supplied; not yet published" for Kentucky. This pass could not confirm that and found no statewide publication.
- **Verdict:** hardest. Realistic routes are a commercial aggregator for statewide coverage plus free county layers like Jefferson, with legal review before any mailing use.

### Differences from the 50-state table below
The table below is mostly confirmed. Differences and additions: Arkansas coverage is 73 of 75 listed counties and there is no acreage field; Indiana's field list was read in full (no owner field, no acreage, no value); Tennessee explicitly offers no bulk or automated downloads, so it is manual per county; Wisconsin owner redaction percentages and the Buffalo and Burnett coverage gaps are now itemized; Kentucky's "108 counties" claim is unconfirmed; Montana's own license text cites 2-6-1017 while other metadata still cites 2-6-109.

### What I could not verify
- Arkansas's current download page (redirects to an unreadable JavaScript hub), and the missing 75th county.
- Tennessee's owner and mailing field names (the dictionary is inside each county download).
- Indiana's DLGF Gateway file contents and terms; the Data Access page was empty.
- Kentucky's statewide status (catalogs unreadable) and the statute text.
- Montana's penalty and the Cadastral FAQ text; the DOR nondisclosure effect on other sites.
- Every state's license in practice: Wisconsin, Indiana, Utah, Arkansas and Montana state no commercial-use clause; Tennessee allows commercial use for the shapefile data but is silent on redistribution. **Get a written answer from each agency before loading.**

### Sources (official pages read for this section)
- Wisconsin: https://www.sco.wisc.edu/parcels/data ; V12 schema https://sco.wisc.edu/parcels/data/assets/V12/V12_Wisconsin_Statewide_Parcels_Schema_Documentation.pdf ; https://sco.wisc.edu/parcels/data/assets/Wisconsin_Statewide_Parcels_Change_Log.pdf ; https://www.sco.wisc.edu/?p=28980
- Arkansas: http://gis.arkansas.gov/Metadata/HTML/asdi.Planning_Cadastre.PARCEL_POLYGON_CAMP_export.html
- Montana: https://msl.mt.gov/geoinfo/msdi/cadastral/ ; https://gisservice.mt.gov/ArcGIS/rest/services/msdi_cadastral_map_v1/MapServer/1
- Indiana: https://www.in.gov/gis/geoinsights/posts/data-harvest ; https://gateway.ifionline.org/public/download.aspx
- Tennessee: https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps/parcel-data.html
- Utah: https://gis.utah.gov/data/cadastre/parcels ; https://gis.utah.gov/data-schema-released-for-expanded-gis-parcel-sharing ; https://www.washco.utah.gov/?p=489
- Kentucky: https://revenue.ky.gov/Property/Mapping-Services/Pages/default.aspx ; https://catalog.data.gov/dataset/jefferson-county-ky-parcels

---

## 1. Short answer

**Statewide free source with owner name + mailing address, confirmed from the live layer's fields:**
- **Florida** (already live): DOR NAL/SDF rolls + parcel GIS. All fields including sale date and price.
- **North Carolina:** NC OneMap, all 100 counties. Owner, mailing, values, acres, land use, sale date (no sale price).
- **Texas:** TxGIO StratMap, free but "not all counties". Owner, mailing, values, land use, acquisition date (no sale price). License not stated.
- **Wisconsin:** Statewide Parcel Map Initiative, about 3.56M parcels. Owner, mailing, values, acres, class (no sales). Some owner redactions.
- **Colorado:** counties opt in. Owner, mailing, values, acres, land use, sale date and price. License text not found.
- **Connecticut:** CC0 public domain. Owner and mailing, but some towns suppress owner names.
- **Vermont:** statewide Grand List join. Owner, mailing, values, acres.
- **New York:** centroid POINTS only (no outlines) for all counties. Owner, mailing, values, acres, class (no sales).

**Free statewide layers that exist but lack owner or mailing data:** Maryland (mailing address pieces but no owner name), Nebraska, Indiana, Hawaii, Utah, Ohio (owner, no mailing), Arkansas (owner, no mailing), Maine (owner in a separate unverified table), New Hampshire.

**Mailing-list / commercial-list laws that matter for a tool that mails owners (Phase F) or contacts them (Phase E):** Montana, Washington, Idaho. Also flagged but weaker or unverified: Arizona, Illinois, Kentucky, Indiana, Maryland. See section 4.

**Georgia (our planned expansion) is COUNTY-ONLY**: no free statewide parcel file. Texas and North Carolina have free statewide owner + mailing data. See section 5.

---

## 2. All 50 states

| State | Statewide free? | Owner | Mailing | Other fields / notes | Restrictions found | Conf |
|---|---|---|---|---|---|---|
| Alabama | County-only | | | State DOR links to county sites only | none found | M |
| Alaska | County/borough-only | no | no | State DNR layer = state land only | none found | M |
| Arizona | County-only | Partial (Apache layer) | no | ADWR per-county layers: APN, situs, owner (Apache) | A.R.S. 39-121.03 commercial-purpose statement (UNVERIFIED); Maricopa bars resale | M |
| Arkansas | Partial (counties with CAMA) | yes | no (situs only) | Assessed, land, improvement values; semi-annual | "may be utilized in any manner"; none found | M-H |
| California | County-only | no | no | DWR layer has no owner; bulk download not public | none found | M |
| Colorado | **Yes** (counties opt in) | yes | yes | Situs, values, acres, land use, sale date + price; annual | no license text found | H fields / L-M terms |
| Connecticut | **Yes** (CC0) | yes (some towns suppressed) | yes | 169 towns, annual, CAMA fields | none (CC0) | H |
| Delaware | Partial | unverified | unverified | FirstMap DE_StateParcels; monthly | terms not read | L-M |
| Florida | **Yes** (live) | yes | yes | NAL/SDF: values, land use, acres, sale date + price | none stated on DOR page | H |
| Georgia | County-only | | | No statewide parcel layer (GIO has none) | none found | M |
| Hawaii | Partial (geometry) | no | no | TMK + acres only | "visual reference only" | H |
| Idaho | Partial (framework) | likely no | likely no | Ada County omits owner/mailing under public-records act | **Idaho Code 74-120 bars mailing-list distribution** (via Ada County) | M |
| Illinois | County-only | varies | varies | | FOIA "commercial purpose" includes solicitation (UNVERIFIED) | M |
| Indiana | Partial (boundaries) | no | no | 3.68M parcels, annual (Data Harvest) | IC 5-14-3-3(f) scope unclear | H / M |
| Iowa | County-only | varies | varies | | none found | M |
| Kansas | County-only | varies | varies | State portal is aggregate only | some counties bar redistribution (Wyandotte) | M |
| Kentucky | Partial, in progress | unverified | unverified | 108 counties supplied; not yet published | KRS 61.870/.874 commercial-purpose (UNVERIFIED) | L-M |
| Louisiana | County(parish)-only | varies | varies | | none found | M |
| Maine | Partial (incomplete) | separate table, unverified | not seen | Layer has IDs + location only | "planning purposes only" | H layer / L owner |
| Maryland | **Yes** (statewide) | not in layer | yes (address pieces) | Assessed values, acres, land use, sale date + price | redistribution OK with credit; RP 12-111 solicitation text (UNVERIFIED) | H fields / M owner |
| Massachusetts | Partial (per-town files, 351 towns) | yes (Assess table) | likely | Values, use code | none found (page returned 403) | M |
| Michigan | County-only (statewide layer internal) | some counties | some | | none found | M |
| Minnesota | Partial (opt-in counties) | unverified | unverified | | disclaimer only | M |
| Mississippi | **Yes** (MARIS, 82 counties, annual) | unverified | unverified | "40+ attributes" | disclaimer only | M |
| Missouri | County-only | | | | none found | M-L |
| Montana | **Yes** (monthly) | yes | yes | Values, acres, property type; no sale data | **2-6-1017 MCA distribution-list law (misdemeanor)** | H fields / M applicability |
| Nebraska | Partial (REST, annual) | **no** | **no** | Situs, values, acres, zoning, sale date + value | "official, internal use" wording | H |
| Nevada | County-only (state layer restricted) | restricted layer | no | | county parcels "cannot be downloaded and shared" | H |
| New Hampshire | Partial | unverified | no | Land use codes only | unverified | L-M |
| New Jersey | Yes, but owner names REDACTED | **no** (Daniel's Law) | unverified | MOD-IV values etc. unverified | owner redaction by statute | M / L |
| New Mexico | County-only | | | | none found | M |
| New York | Partial (**centroid points**, all counties) | yes | yes | Values, acres, class; no sales | no license; "as is"; none found | H / M |
| North Carolina | **Yes** (100 counties, weekly) | yes | yes | Values, acres, land use, sale date (no price) | license unlisted; none found | H / M |
| North Dakota | Yes (2021, about 727k parcels), fields unverified | unverified | unverified | Includes tax roll records | none found | M / L |
| Ohio | Partial (DNR compilation) | yes | no | Acres | license blank | M |
| Oklahoma | County-only | | | | none found | M |
| Oregon | Partial, in development (5 counties) | unverified | unverified | | none found | M |
| Pennsylvania | County-only | varies | varies | | none found | M |
| Rhode Island | Partial, in progress | unverified | unverified | | planning-use disclaimer | L-M |
| South Carolina | County-only | | | | none found | M |
| South Dakota | County-only (none public found) | | | | none found | L |
| Tennessee | Partial (per county, on request; 9 largest counties excluded) | separate table, unverified | unverified | Weekly | **commercial use explicitly allowed** | H terms / L contents |
| Texas | **Yes** (not all counties, annual) | yes | yes | Values, land use, acquisition date, year built; no sale price | license NOT stated; none found | H fields / L license |
| Utah | Partial | **no** | **no** | Market values, acres | "no constraints"; owner excluded by design | H |
| Vermont | **Yes** (weekly) | yes | yes | Values, acres | planning-use disclaimer | H / M |
| Virginia | Partial, thin | unverified | unverified | | not found | L |
| Washington | Partial | not in public layer | not in public layer | Situs, values | **RCW 42.56.070(8): no lists of individuals for commercial purposes**; some counties "state business only" | M |
| West Virginia | **Yes** (annual) | unverified | no (parcel address is not owner address) | | tax-assessment-use disclaimer | M |
| Wisconsin | **Yes** (V12, about 3.56M) | yes (some redactions) | yes | Values, acres, class; no sales | no license named; free of charge | H / M |
| Wyoming | Partial (viewer only) | viewer | unknown | | "All Rights Reserved" | L |

---

## 3. Ranking

Method: three things, my own judgment, not measured: (a) data completeness for our columns (owner, mailing, situs, value, acreage, land use, sales), (b) fewest known restrictions, (c) size of the land-investor market (my judgment, NOT researched here). Only states with a usable statewide free source are ranked.

| Rank | State | Why | Gaps / risks | Market (judgment) |
|---|---|---|---|---|
| 0 | Florida | Live; everything we need | none | Large |
| 1 | **Texas** | Owner + mailing + values + land use; free; large market | No sale price; "not all counties"; license unstated; fill rates unknown | Very large |
| 2 | **North Carolina** | Owner + mailing + values + acres + sale date; all 100 counties; weekly | No sale price; license unlisted | Large |
| 3 | **Colorado** | Fullest field set incl. sale date + price | Counties opt in; license text not found | Mid |
| 4 | **Wisconsin** | Owner + mailing; about 3.56M parcels; annual releases | No sales; some owner redactions | Mid |
| 5 | **New York** | Owner + mailing + values for all counties | Points only, no outlines; no sales | Mid (upstate land) |
| 6 | **Connecticut** | CC0 license; owner + mailing | Some towns suppress owners; small market | Small |
| 7 | **Vermont** | Owner + mailing + values | Small market | Small |
| 8 | Massachusetts | Owner data per town | Per-town files; page unread; mailing unconfirmed | Small-mid |
| 9 | North Dakota | Statewide dataset exists | Fields unverified | Small |
| 10 | Mississippi | Statewide layer, 82 counties | Owner fields unverified | Mid |

**Not recommended for a mailing product:** Montana, Washington, Idaho (statutes in section 4). Washington and Idaho also lack owner data in their public layers. **Not useful without extra data:** Nebraska, Indiana, Hawaii, Utah, New Jersey (no owner).

Close runner-ups to check: **Tennessee** (commercial use explicitly allowed, a large land market, but county by county and the 9 largest counties are excluded) and **Maryland** (mailing address without a name).

---

## 4. Laws and restrictions to take seriously

These matter most for Phase F (mail) and Phase E (skip tracing). Simply SHOWING public-record owner data is a different question from MAILING to the people on it. Get legal advice before relying on any of this.

- **Montana, 2-6-1017 MCA** (researcher read the text): a public agency may not distribute or sell a "distribution list", and a list prepared by an agency may not be used as a distribution list without permission of those on it; violating (1)(b) is a misdemeanor. A "distribution list" is personal contact information used for unsolicited contact. Subsection (3) exempts lists an individual compiles from open public records. The State Library metadata still cites the repealed 2-6-109 and calls mailing-list use "a punishable offense". Montana also lets owners request non-disclosure. **High risk for a mail tool; needs legal advice.**
- **Washington, RCW 42.56.070(8):** agencies may not give, sell or provide access to lists of individuals requested for commercial purposes. Some counties' parcel layers are "State of Washington business only". **Serious barrier.**
- **Idaho Code 74-120** (via Ada County's page): no distribution or sale "for use as a mailing list" of persons' addresses without permission of everyone on the list. Ada County omits owner names and mailing addresses.
- **Arizona A.R.S. 39-121.03** (agency forms, UNVERIFIED): public-records requests need a statement of commercial purpose; using names/addresses to solicit business counts. Maricopa County bars resale of its downloads without a sublicense.
- **Illinois FOIA** (5 ILCS 140/2(c-10), UNVERIFIED wording): "commercial purpose" includes solicitation.
- **Kentucky KRS 61.870/.874, Indiana IC 5-14-3-3(f), Maryland Real Property 12-111:** commercial-purpose or solicitation language exists; scope for assessor owner lists is UNVERIFIED in each.
- **New Jersey:** owner names are redacted from hosted downloads under Daniel's Law (P.L. 2020, c. 125).
- **Wisconsin Act 235 (2025):** judicial officers can shield their names; some counties opted out of owner data (Kenosha fully redacted as of an older release). Current redaction status UNVERIFIED.
- **Texas Tax Code 25.025:** hides home addresses of protected persons only. No mailing-list rule found.
- **Tennessee:** the Comptroller page says any person or organization may use the shapefile data "for any purpose, including commercial". Redistribution not addressed.
- **Connecticut:** CC0 (public domain); no restriction.

**Licensing gap to close for the top candidates:** Texas (TxGIO), North Carolina (NC OneMap/CGIA) and Colorado state no license in their layer metadata, and the terms pages the researchers tried to read did not load. Before loading any of them, email or call the agency and ask in writing whether commercial use and redistribution inside a paid product are allowed.

---

## 5. What this means for Land Oracle

- **Georgia (Phase H):** confirmed COUNTY-ONLY with no free statewide parcel file. Adding Georgia means buying data or collecting from 159 counties.
- **Cheaper expansion candidates:** Texas and North Carolina each have free statewide owner + mailing data, so the data cost could be near zero. Texas is the biggest land market. Both lack sale price, and Texas is not complete.
- **Sales fields:** our Florida product has sale date and price. NC has date only, TX has acquisition date only, WI/NY/VT have none. Filters like "years since last sale" would work differently or be hidden per state (Phase H step 6).
- **Mail and skip tracing by state:** do not offer mailing or skip tracing for Montana, Washington or Idaho owner data. For other states, check the state's rules before enabling Phase E/F there.
- **Next verification steps (cheap, before any build):**
  1. Email TxGIO and NC CGIA: commercial use and redistribution in a paid subscription product? Any attribution required?
  2. Sample 3 counties in Texas and 3 in North Carolina (one metro, one rural, one coastal/edge): owner and mailing fill rates, record freshness, parcel counts.
  3. Confirm Colorado's coverage (which counties are public) and license.
  4. Check Wisconsin V12 owner redaction status on a few counties.
  5. If a mailing product is planned for a state, get legal advice on that state's mailing-list rules first.

## 6. Sources (official pages the researchers reported reading)

- Florida DOR: https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
- North Carolina OneMap parcels: https://www.nconemap.gov/pages/parcels ; service https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0
- Texas TxGIO StratMap: https://www.geographic.texas.gov/stratmap/land-parcels.html
- Wisconsin SCO: https://www.sco.wisc.edu/parcels/data
- Colorado public parcels: https://gis.colorado.gov/Public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer/0
- Connecticut CAMA + parcels: https://geodata.ct.gov/datasets/ctmaps::connecticut-cama-and-parcel-layer-2025
- Vermont VCGI: https://maps.vcgi.vermont.gov/gisdata/metadata/CadastralParcels_VTPARCELS.htm
- New York ITS: https://gis.ny.gov/parcels
- Montana State Library cadastral service: https://gisservice.mt.gov/ArcGIS/rest/services/msdi_cadastral_map_v1/MapServer/1
- Maryland MD iMAP: https://geodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0
- Nebraska: https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0
- Tennessee Comptroller: https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps/parcel-data.html
- Utah AGRC: https://gis.utah.gov/products/sgid/cadastre/parcels/
- Washington RCW 42.56.070: https://app.leg.wa.gov/rcw/default.aspx?cite=42.56.070
- Georgia GIO: https://gio.ga.gov/about/
- Arkansas metadata: https://gis.arkansas.gov/metadata/HTML/asdi.planning_cadastre.PARCEL_POLYGON_CAMP_export.html
- California DWR: https://gis.water.ca.gov/arcgis/rest/services/planning/i15_Parcels_Assessor_Lightbox/MapServer/0
- Arizona ADWR: https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer
- Delaware FirstMap: https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/FeatureServer
- Hawaii: https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25
- Idaho (Ada County page quoting Idaho Code 74-120): https://adacounty.id.gov/assessor/?p=65 ; Idaho GIO: https://gis.idaho.gov/?p=1764
- Indiana: https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2024/FeatureServer
- Maine: https://services1.arcgis.com/RbMX0mRVOFNTdLzd/ArcGIS/rest/services/Parcels/FeatureServer
- Massachusetts: https://www.mass.gov/info-details/massgis-data-property-tax-parcels
- Minnesota: https://gisdata.mn.gov/dataset/plan-parcels-open
- Mississippi MARIS: https://maris.mississippi.edu/HTML/DATA/data_Cadastral/CadastralFramework.html
- Nevada: https://arcgis.water.nv.gov/arcgis/rest/services/NDSL/Facilities_Map_V2/MapServer/63
- New Hampshire GRANIT: https://nhgeodata.unh.edu/nhgeodata/rest/services/CAD/ParcelMosaic/MapServer
- New Jersey NJGIN: https://nj.gov/njgin/edata/parcels/
- North Dakota: https://www.gis.nd.gov/news/north-dakota-statewide-parcels
- Ohio DNR: https://gis.ohiodnr.gov/arcgis/rest/services/OIT_Services/odnr_landbase_v2/MapServer/4
- Oregon GEOHub: https://geohub.oregon.gov/pages/parcel-viewer
- Rhode Island: https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer
- West Virginia: https://mapwv.gov/parcel/mobile/
- Wyoming: https://wyo-prop-div.wyo.gov/tax-districts/maps-gis-data
- Alabama county directory: https://www.revenue.alabama.gov/property-tax/county-offices-appraisal-assessment-records/
- Alaska DNR: https://dnr.alaska.gov/commis/pic/faq
