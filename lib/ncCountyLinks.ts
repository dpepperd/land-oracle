// North Carolina county property-record links (admin pilot). Client-safe, no database.
// Rule: a county is listed here ONLY if its link was tested against real parcels (or, for search pages, the page was confirmed
// to be the county's official lookup). No guessed URLs. A county with no entry shows plain text for the parcel ID.
//
//   direct: opens that parcel's record. `build` returns null when the ID is missing or in a shape the county site cannot use.
//   search: opens the county's search page and the app copies the parcel ID for the user to paste (like Florida's "manual search" counties).

export interface NcLinkInput { parcel_id?: string | null; alt_key?: string | null }
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
