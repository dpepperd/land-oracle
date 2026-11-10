# 50-State Survey: Free Official Statewide Parcel Data (2026-11-10)

**Purpose:** find which states publish a FREE, OFFICIAL, statewide parcel dataset (with owner and mailing address) that Land Oracle could load, versus data that exists only county by county.

**How this was made:** five parallel web-research passes (about ten states each), then compiled here. It is desk research from agency pages, ArcGIS service metadata and search results. **Nothing here has been downloaded or tested.** Anything marked UNVERIFIED was not confirmed on an official page. Statutes are cited as the researchers found them; none is legal advice. Several agency pages returned 403/404 to the researchers, so "not found" means "not found by this survey", not "does not exist". Third-party sellers (Regrid, Land Records, ReportAll, ...) are mentioned only as notes: they are not free official sources.

Confidence key: H = read the official page or live service; M = official snippet or partial read; L = inferred or secondhand.

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
