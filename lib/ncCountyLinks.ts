// North Carolina county property-record links (admin pilot). Client-safe, no database.
// Rule: a county is listed here ONLY if its link was tested against real parcels (or, for search pages, the page was confirmed
// to be the county's official lookup). No guessed URLs. A county with no entry shows plain text for the parcel ID.
//
//   direct: opens that parcel's record. `build` returns null when the ID is missing or in a shape the county site cannot use.
//   search: opens the county's search page and the app copies the parcel ID for the user to paste (like Florida's "manual search" counties).

export interface NcLinkInput { parcel_id?: string | null; alt_key?: string | null; /** Only used by counties whose lookup cannot search by parcel number (Craven). */ owner_name?: string | null }
export interface NcLink {
  url: string;
  kind: 'direct' | 'search';
  /** Value the app copies to the clipboard (search pages only). */
  copy?: string;
  /** Short label for the tooltip, e.g. "Wake County Real Estate". */
  label: string;
}

type Entry =
  | { kind: 'direct'; label: string; build: (p: NcLinkInput) => string | null }
  | { kind: 'search'; label: string; url: string; copy: 'parcel_id' | 'alt_key'; /** Optional: reshape the copied value (e.g. drop a suffix the county's search box does not take). */ pick?: (p: NcLinkInput) => string | null };

const digits = (s: string | null | undefined) => (s ?? '').replace(/[^0-9A-Za-z]/g, '');

/** For "starts with" owner searches (iasWorld): "HUFFMAN, LUKE GARRISON ETAL" -> "HUFFMAN, LUKE"; a name with no comma keeps its first 3 words. */
export function ownerPrefix(name: string | null | undefined): string | null {
  const n = (name ?? '').replace(/\s+/g, ' ').trim();
  if (n.length < 3) return null;
  const m = /^([^,]+),\s*([^\s,&;]+)/.exec(n);
  return m ? `${m[1].trim()}, ${m[2]}` : n.split(' ').slice(0, 3).join(' ');
}

// Keyed by NC FIPS county code (co_no). Filled from tested research; see docs/nc-county-links.md.
export const NC_LINKS: Record<number, Entry> = {
  // ---- direct: fetched against 3 real parcels each; owner and address matched our data ----
  1: { kind: 'direct', label: 'Alamance County Property', build: p => (p.alt_key && /^\d{4,8}$/.test(p.alt_key) ? `https://property.spatialest.com/nc/alamance#/property/${p.alt_key}` : null) },
  183: { kind: 'direct', label: 'Wake County Real Estate', build: p => (p.alt_key && /^\d{4,8}$/.test(p.alt_key) ? `https://services.wake.gov/realestate/Account.asp?id=${p.alt_key}` : null) },
  21: { kind: 'direct', label: 'Buncombe County Tax', build: p => (p.parcel_id && /^\d{10,15}$/.test(p.parcel_id) ? `https://tax.buncombenc.gov/Parcel/Details/${p.parcel_id}` : null) },
  63: { kind: 'direct', label: 'Durham County Property', build: p => (p.alt_key && /^\d{3,8}$/.test(p.alt_key) ? `https://taxcama.dconc.gov/camapwa/PropertySummary.aspx?REID=${p.alt_key}` : null) },
  151: { kind: 'direct', label: 'Randolph County Property', build: p => (p.alt_key && /^\d{3,8}$/.test(p.alt_key) ? `https://txpwa.randolphcountync.gov/camapwa/PropertySummary.aspx?REID=${p.alt_key}` : null) },
  71: { kind: 'direct', label: 'Gaston County Tax', build: p => (p.alt_key && /^\d{3,8}$/.test(p.alt_key) ? `https://gastonnc.devnetwedge.com/parcel/view/${p.alt_key}/2026` : null) },
  // Yancey: the county's assessor database is a GET search form; a search by parcel number redirects straight to that parcel's record page
  199: { kind: 'direct', label: 'Yancey County Assessor', build: p => (p.parcel_id && /^\d{15}$/.test(p.parcel_id) ? `https://yancey.ias-clt.com/parcel.list.php?parcel.search%5Bp_parid%5D=${p.parcel_id}&parcel.search%5Bsearch%5D=Search` : null) },
  // Union: its county property portal is a Spatialest record card (4 parcels checked, 8 digits with or without a one-letter suffix = about 98% of parcels; other shapes show as text)
  179: { kind: 'direct', label: 'Union County Property', build: p => (p.parcel_id && /^\d{8}[A-Z]?$/.test(p.parcel_id) ? `https://property.spatialest.com/nc/union#/property/${p.parcel_id}` : null) },
  // Iredell: results page for the parcel (one row per tax year; click the newest year's "PRC" for the record card)
  97: { kind: 'direct', label: 'Iredell County Tax (results by parcel)', build: p => (p.parcel_id && /^\d{10}\.\d{3}$/.test(p.parcel_id) ? `https://taxweb.iredellcountync.gov/PublicAccess/SearchResults.aspx?field=parcel&parcel=${p.parcel_id}&order=Owner%20Name` : null) },
  // Wilson: DEVNET wEdge (same vendor as Gaston) but its record address needs an internal id; the site's quick-search address takes our PIN
  // as is and shows a one-row result (3 parcels checked). Click the number in the row for the record.
  195: { kind: 'direct', label: 'Wilson County Property Tax Inquiry (search result for this PIN)', build: p => (p.parcel_id && /^\d{4}-\d{2}-\d{4}\.\d{3}$/.test(p.parcel_id) ? `https://wilsonnc.devnetwedge.com/search/quick?q=${p.parcel_id}` : null) },
  // Wayne: ITSNet "Basic Search" (supplied by the owner); its results page takes the parcel in the address, like Iredell (3 parcels checked)
  191: { kind: 'direct', label: 'Wayne County Property (results for this parcel)', build: p => (p.parcel_id && /^\d{10}$/.test(p.parcel_id) ? `https://realestate.waynegov.com/ITSNet/SearchResults.aspx?field=parcel&parcel=${p.parcel_id}&order=Owner%20Name` : null) },
  // Washington: the county tax site (supplied by the owner) opens a parcel's details from the PIN in the address; its PIN format is our alt_key
  // (3 parcels checked). The site is http only (no https).
  187: { kind: 'direct', label: 'Washington County Property & Building Records', build: p => (p.alt_key && /^\d{4}\.\d{2}-\d{2}-\d{4}$/.test(p.alt_key) ? `http://taxweb.washconc.org/Details.aspx?pin=${p.alt_key}` : null) },
  // Spatialest record cards (same site as Alamance); which of our IDs the card uses differs by county
  135: { kind: 'direct', label: 'Orange County Property', build: p => (p.parcel_id && /^\d{10}(\.\d{1,4})?$/.test(p.parcel_id) ? `https://property.spatialest.com/nc/orange#/property/${p.parcel_id}` : null) },
  // Pitt's card id is the county parcel number WITHOUT leading zeros (alt_key 05533 -> 5533; with the zero the county shows "not found")
  147: { kind: 'direct', label: 'Pitt County Property', build: p => (p.alt_key && /^\d{1,7}$/.test(p.alt_key) && Number(p.alt_key) > 0 ? `https://property.spatialest.com/nc/pitt#/property/${Number(p.alt_key)}` : null) },
  89: { kind: 'direct', label: 'Henderson County Property', build: p => (p.alt_key && /^\d{5,10}$/.test(p.alt_key) ? `https://property.spatialest.com/nc/henderson#/property/${p.alt_key}` : null) },

  // ---- search: the county's own lookup page (linked from the county website); the parcel ID is copied for pasting ----
  // Yadkin: map viewer; accept its disclaimer popup, then paste the copied number into "Enter Parcel ID" (alt_key; the PIN it shows is our parcel_id)
  197: { kind: 'search', label: 'Yadkin County GIS (accept the disclaimer, paste into Parcel ID)', url: 'https://gis.yadkincountync.gov/', copy: 'alt_key' },
  // Guilford and Forsyth: "Real Property PWA" (record pages need the county's internal number, which we do not have); its search box takes the 10-digit PIN.
  81: { kind: 'search', label: 'Guilford County Property (paste the PIN)', url: 'https://lrcpwa.ncptscloud.com/guilford/parcel-search', copy: 'parcel_id', pick: p => { const m = /^(\d{10})(-\d{3})?$/.exec(p.parcel_id ?? ''); return m ? m[1] : null; } },
  67: { kind: 'search', label: 'Forsyth County Property (paste the PIN)', url: 'https://lrcpwa.ncptscloud.com/forsyth/parcel-search', copy: 'alt_key', pick: p => (/^\d{10}$/.test(p.alt_key ?? '') ? p.alt_key! : null) },
  // Searches below were each tried in a real browser with our IDs (see docs/nc-pilot.md for the exact field to paste into)
  159: { kind: 'search', label: 'Rowan County Property (paste into Parcel ID)', url: 'https://tax.rowancountync.gov/search/commonsearch.aspx?mode=realprop', copy: 'parcel_id' },
  129: { kind: 'search', label: 'New Hanover County Property (agree to disclaimer, paste into Parcel ID)', url: 'https://etax.nhcgov.com/pt/search/commonsearch.aspx?mode=parid', copy: 'alt_key' },
  19: { kind: 'search', label: 'Brunswick County Tax (choose "Parcel Number", paste)', url: 'https://tax.brunsco.net/itsnet/', copy: 'parcel_id' },
  133: { kind: 'search', label: 'Onslow County Tax (choose "Alternate Parcel ID#", paste into Map Number)', url: 'https://tax.onslowcountync.gov/ITSPublicON/', copy: 'parcel_id' },
  45: { kind: 'search', label: 'Cleveland County Taxes (accept, search, pick the "Parcel" suggestion)', url: 'https://www.clevelandcountytaxes.com/taxes.html', copy: 'parcel_id' },
  57: { kind: 'search', label: 'Davidson County Tax (choose "PIN#", paste, Submit)', url: 'https://taxsearch.co.davidson.nc.us/', copy: 'parcel_id' },
  51: { kind: 'search', label: 'Cumberland County Bills (Search By "Parcel Number", paste)', url: 'https://taxpwa.co.cumberland.nc.us/publicwebaccess/', copy: 'parcel_id' },
  // Moore: county ArcGIS viewer (supplied by the owner); tick "I Agree" + OK, open "Parcel ID Query", paste into "PIN is", click Apply (1 parcel checked)
  125: { kind: 'search', label: 'Moore County GIS (agree to disclaimer, Parcel ID Query, paste into PIN)', url: 'https://experience.arcgis.com/experience/372f89e6fdcb4bd5af38256a9744ed14/', copy: 'parcel_id', pick: p => (/^\d{12}$/.test(p.parcel_id ?? '') ? p.parcel_id! : null) },
  // Craven: the real-property portal (supplied by the owner) has NO parcel-number search, only owner name or address (address is split into
  // house number + street boxes). So the OWNER NAME is copied; type it in the "Property Owner Name" box (3 parcels checked: 2 companies, 1 person).
  49: { kind: 'search', label: 'Craven County Property (paste the owner name, click Submit)', url: 'https://www.bttaxpayerportal.com/ITSPublicCRRP', copy: 'parcel_id', pick: p => { const n = (p.owner_name ?? '').trim(); return n.length >= 3 ? n : null; } },
  // Johnston: Basic Search (supplied by the owner). Its Parcel Number boxes want the county's own parcel number (not our PIN), so the OWNER NAME is
  // copied; the results table shows a "PIN ID#" column that equals our parcel_id, to pick the right row (3 parcels checked).
  101: { kind: 'search', label: 'Johnston County Property (paste the owner name, Submit, match the PIN ID#)', url: 'https://www.bttaxpayerportal.com/itspublicjo', copy: 'parcel_id', pick: p => { const n = (p.owner_name ?? '').trim(); return n.length >= 3 ? n : null; } },
  // Burke: county GIS viewer (supplied by the owner); click Accept on the disclaimer, paste the 10-digit PIN into "Enter PIN", press Enter (1 parcel checked)
  23: { kind: 'search', label: 'Burke County GIS (accept the disclaimer, paste into Enter PIN)', url: 'https://gis.burkenc.org/', copy: 'parcel_id', pick: p => (/^\d{10}$/.test(p.parcel_id ?? '') ? p.parcel_id! : null) },
  // Wilkes: iasWorld search (supplied by the owner). It has no PIN box and the PINs in our file differ from the county's for some parcels, so the OWNER's
  // "LAST, FIRST" is copied (the site matches the start of the name); paste into "Owner Name", press Enter, pick the row with your address (3 parcels checked).
  193: { kind: 'search', label: 'Wilkes County Property (paste the owner name, press Enter, match the address)', url: 'https://parcelinfo.wilkescounty.net/search/commonsearch.aspx?mode=realprop', copy: 'parcel_id', pick: p => ownerPrefix(p.owner_name) },
  // Watauga: iasWorld Public Access; the address goes through its disclaimer page (click Agree) and lands on the Parcel ID search; paste the 13-digit
  // county parcel id (our alt_key) and press Enter (3 parcels checked)
  189: { kind: 'search', label: 'Watauga County Property (click Agree, paste into Parcel ID)', url: 'https://tax.watgov.org/WataugaNC/Search/Disclaimer.aspx?FromUrl=../search/commonsearch.aspx?mode=parid', copy: 'alt_key', pick: p => (/^\d{13}$/.test(p.alt_key ?? '') ? p.alt_key! : null) },
  7: { kind: 'search', label: 'Anson County Tax', url: 'https://www.bttaxpayerportal.com/itspublican/TaxBillSearch', copy: 'parcel_id' },
  119: { kind: 'search', label: 'Mecklenburg County Polaris', url: 'https://polaris3g.mecklenburgcountync.gov/', copy: 'parcel_id' },
  25: { kind: 'search', label: 'Cabarrus County Real Estate', url: 'https://tax.cabarruscounty.us/RealEstate.aspx', copy: 'alt_key' },
  35: { kind: 'search', label: 'Catawba County Parcels', url: 'https://gis.catawbacountync.gov/parcel/', copy: 'parcel_id' },
  155: { kind: 'search', label: 'Robeson County Tax', url: 'https://www.ustaxdata.com/nc/robeson/robesonSearch.cfm', copy: 'parcel_id' },
  31: { kind: 'search', label: 'Carteret County Tax', url: 'https://bttaxpayerportal.com/ITSPublicCE', copy: 'parcel_id' },
  85: { kind: 'search', label: 'Harnett County GIS', url: 'https://gis.harnett.org/gisviewer/', copy: 'parcel_id' },
};

/** Link for a North Carolina parcel, or null when the county has no verified link or the ID is unusable. */
export function ncCountyLink(coNo: number | null | undefined, p: NcLinkInput): NcLink | null {
  if (!coNo) return null;
  const e = NC_LINKS[coNo];
  if (!e) return null;
  if (e.kind === 'direct') {
    const url = e.build(p);
    return url ? { url, kind: 'direct', label: e.label } : null;
  }
  const copy = (e.pick ? e.pick(p) : e.copy === 'alt_key' ? p.alt_key : p.parcel_id) ?? '';
  return copy ? { url: e.url, kind: 'search', copy, label: e.label } : null;
}

export { digits as _digits };
