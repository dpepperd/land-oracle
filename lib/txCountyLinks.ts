// Texas county property-record links (admin pilot). Client-safe, no database.
// Rule: a county is listed ONLY if its link was tested against real parcels (3 per county: page loads, owner name matches our data).
// No guessed URLs. A county with no entry shows plain text for the parcel ID.
//
// BIS Consultants "eSearch" sites open a parcel directly: https://<host>/Property/View/<Prop_ID>. Our parcel_id is the appraisal
// district's Prop_ID, so no copying is needed.
import type { NcLink } from '@/lib/ncCountyLinks';

export type TxLink = NcLink;
export interface TxLinkInput { parcel_id?: string | null; /** Tarrant: the TAD account number (filled from TAD's public map layer, see scripts/data-layers/tx-tarrant-pid.cjs). */ alt_key?: string | null }

/** BIS eSearch hosts, keyed by Texas county FIPS code (co_no). */
export const TX_BIS_HOSTS: Record<number, { host: string; name: string }> = {
  3: { host: 'esearch.andrewscad.org', name: 'Andrews' },
  5: { host: 'esearch.angelinacad.org', name: 'Angelina' },
  7: { host: 'esearch.aransascad.org', name: 'Aransas' },
  13: { host: 'esearch.atascosacad.com', name: 'Atascosa' },
  15: { host: 'esearch.austincad.org', name: 'Austin' },
  17: { host: 'esearch.bailey-cad.org', name: 'Bailey' },
  21: { host: 'esearch.bastropcad.org', name: 'Bastrop' },
  25: { host: 'esearch.beecad.org', name: 'Bee' },
  31: { host: 'esearch.blancocad.com', name: 'Blanco' },
  33: { host: 'esearch.bordencad.org', name: 'Borden' },
  39: { host: 'esearch.brazoriacad.org', name: 'Brazoria' },
  41: { host: 'esearch.brazoscad.org', name: 'Brazos' },
  47: { host: 'esearch.brookscad.org', name: 'Brooks' },
  49: { host: 'esearch.brown-cad.org', name: 'Brown' },
  53: { host: 'esearch.burnet-cad.org', name: 'Burnet' },
  55: { host: 'esearch.caldwellcad.org', name: 'Caldwell' },
  57: { host: 'esearch.calhouncad.org', name: 'Calhoun' },
  63: { host: 'esearch.campcad.org', name: 'Camp' },
  67: { host: 'esearch.casscad.org', name: 'Cass' },
  69: { host: 'esearch.castrocad.org', name: 'Castro' },
  73: { host: 'esearch.cherokeecad.com', name: 'Cherokee' },
  79: { host: 'esearch.cochrancad.com', name: 'Cochran' },
  85: { host: 'esearch.collincad.org', name: 'Collin' },
  89: { host: 'esearch.coloradocad.org', name: 'Colorado' },
  91: { host: 'esearch.comalad.org', name: 'Comal' },
  93: { host: 'esearch.comanchecad.org', name: 'Comanche' },
  99: { host: 'esearch.coryellcad.org', name: 'Coryell' },
  111: { host: 'esearch.dallamcad.org', name: 'Dallam' },
  117: { host: 'esearch.deafsmithcad.org', name: 'Deaf Smith' },
  119: { host: 'esearch.delta-cad.org', name: 'Delta' },
  127: { host: 'esearch.dimmit-cad.org', name: 'Dimmit' },
  131: { host: 'esearch.duvalcad.org', name: 'Duval' },
  137: { host: 'esearch.edwardscad.org', name: 'Edwards' },
  145: { host: 'esearch.fallscad.net', name: 'Falls' },
  149: { host: 'esearch.fayettecad.org', name: 'Fayette' },
  165: { host: 'esearch.gainescad.org', name: 'Gaines' },
  167: { host: 'esearch.galvestoncad.org', name: 'Galveston' },
  169: { host: 'esearch.garzacad.org', name: 'Garza' },
  171: { host: 'esearch.gillespiecad.org', name: 'Gillespie' },
  179: { host: 'esearch.graycad.org', name: 'Gray' },
  187: { host: 'esearch.guadalupead.org', name: 'Guadalupe' },
  189: { host: 'esearch.halecad.org', name: 'Hale' },
  199: { host: 'esearch.hardin-cad.org', name: 'Hardin' },
  213: { host: 'esearch.henderson-cad.org', name: 'Henderson' },
  217: { host: 'esearch.hillcad.org', name: 'Hill' },
  219: { host: 'esearch.hockleycad.org', name: 'Hockley' },
  227: { host: 'esearch.howardcad.org', name: 'Howard' },
  229: { host: 'esearch.hudspethcad.org', name: 'Hudspeth' },
  241: { host: 'esearch.jaspercad.org', name: 'Jasper' },
  245: { host: 'esearch.jcad.org', name: 'Jefferson' },
  257: { host: 'esearch.kaufman-cad.org', name: 'Kaufman' },
  261: { host: 'esearch.kenedycad.org', name: 'Kenedy' },
  265: { host: 'esearch.kerrcad.org', name: 'Kerr' },
  267: { host: 'esearch.kimblecad.org', name: 'Kimble' },
  271: { host: 'esearch.kinneycad.org', name: 'Kinney' },
  273: { host: 'esearch.kleberg-cad.org', name: 'Kleberg' },
  277: { host: 'esearch.lamarcad.org', name: 'Lamar' },
  279: { host: 'esearch.lambcad.org', name: 'Lamb' },
  281: { host: 'esearch.lampasascad.com', name: 'Lampasas' },
  285: { host: 'esearch.lavacacad.com', name: 'Lavaca' },
  287: { host: 'esearch.lee-cad.org', name: 'Lee' },
  291: { host: 'esearch.libertycad.com', name: 'Liberty' },
  311: { host: 'esearch.mcmullencad.org', name: 'McMullen' },
  313: { host: 'esearch.madisoncad.org', name: 'Madison' },
  319: { host: 'esearch.masoncad.org', name: 'Mason' },
  321: { host: 'esearch.matagorda-cad.org', name: 'Matagorda' },
  325: { host: 'esearch.medinacad.org', name: 'Medina' },
  335: { host: 'esearch.mitchellcad.org', name: 'Mitchell' },
  341: { host: 'esearch.moorecad.org', name: 'Moore' },
  351: { host: 'esearch.newtoncad.org', name: 'Newton' },
  355: { host: 'esearch.nuecescad.net', name: 'Nueces' },
  369: { host: 'esearch.parmercad.org', name: 'Parmer' },
  373: { host: 'esearch.polkcad.org', name: 'Polk' },
  377: { host: 'esearch.presidiocad.org', name: 'Presidio' },
  379: { host: 'esearch.rainscad.org', name: 'Rains' },
  385: { host: 'esearch.realcad.org', name: 'Real' },
  413: { host: 'esearch.schleichercad.org', name: 'Schleicher' },
  417: { host: 'esearch.shackelfordcad.com', name: 'Shackelford' },
  419: { host: 'esearch.shelbycad.com', name: 'Shelby' },
  427: { host: 'esearch.starrcad.org', name: 'Starr' },
  435: { host: 'esearch.suttoncad.com', name: 'Sutton' },
  437: { host: 'esearch.swisher-cad.org', name: 'Swisher' },
  441: { host: 'esearch.taylor-cad.org', name: 'Taylor' },
  449: { host: 'esearch.titus-cad.org', name: 'Titus' },
  455: { host: 'esearch.trinitycad.net', name: 'Trinity' },
  457: { host: 'esearch.tylercad.net', name: 'Tyler' },
  459: { host: 'esearch.upshur-cad.org', name: 'Upshur' },
  463: { host: 'esearch.uvaldecad.org', name: 'Uvalde' },
  471: { host: 'esearch.walkercad.org', name: 'Walker' },
  473: { host: 'esearch.waller-cad.org', name: 'Waller' },
  477: { host: 'esearch.washingtoncad.org', name: 'Washington' },
  489: { host: 'esearch.willacycad.org', name: 'Willacy' },
  493: { host: 'esearch.wilson-cad.org', name: 'Wilson' },
  499: { host: 'esearch.woodcad.net', name: 'Wood' },
  501: { host: 'esearch.yoakumcad.org', name: 'Yoakum' },
  503: { host: 'esearch.youngcad.org', name: 'Young' },
  505: { host: 'esearch.zapatacad.com', name: 'Zapata' },
  507: { host: 'esearch.zavalacad.com', name: 'Zavala' },
};

/** The appraisal roll year that Bexar's portal needs in its address (`/property/<year>-<id>`). Update when the new roll opens. */
export const TX_ROLL_YEAR = 2026;
const TRAVIS = 453;
const BEXAR = 29;
const HARRIS = 201;
const TARRANT = 439;
const EL_PASO = 141;

/** Dallas CAD: one account page per 17-digit account (the residential page shows commercial accounts too; tested on 10 random parcels). */
const DALLAS = 113;

export function txCountyLink(coNo: number | null | undefined, p: TxLinkInput): TxLink | null {
  const id = (p.parcel_id ?? '').trim();
  if (coNo === DALLAS) return /^\d{17}$/.test(id) ? { kind: 'direct', url: `https://www.dallascad.org/AcctDetailRes.aspx?ID=${id}`, label: 'Dallas CAD account detail' } : null;
  // Harris (HCAD): the parcel viewer has no address that opens one parcel, but its search box takes the 13-digit account number.
  if (coNo === HARRIS) return /^\d{13}$/.test(id) ? { kind: 'search', url: 'https://arcweb.hcad.org/parcel-viewer-v2.0/', copy: id, label: 'paste the account number into the "Find address or place" box at the top of the map, then pick the parcel from the list' } : null;
  // Tarrant (TAD): the property page takes the 8-digit account number (PID), which we hold in alt_key.
  if (coNo === TARRANT) { const a = (p.alt_key ?? '').trim(); return /^\d{1,8}$/.test(a) ? { kind: 'direct', url: `https://www.tad.org/property?account=${a.padStart(8, '0')}`, label: 'Tarrant Appraisal District property page' } : null; }
  // El Paso (EPCAD): the search page takes the property id in the address and shows that property as the result. Its policy forbids automated
  // access, so this was NOT checked by script: the owner tested one id by hand (390172). No year is sent, so the site uses its default.
  if (coNo === EL_PASO) return /^\d{1,9}$/.test(id) ? { kind: 'direct', url: `https://epcad.org/Search?Keywords=${id}`, label: 'El Paso CAD property search (this property shows as the result)' } : null;
  // Travis CAD (TrueProdigy portal): opens the property by its id. Bexar CAD (Harris Govern portal): `<roll year>-<id>`.
  if (coNo === TRAVIS) return /^\d{1,9}$/.test(id) ? { kind: 'direct', url: `https://travis.prodigycad.com/property-detail/${id}`, label: 'Travis CAD property search' } : null;
  if (coNo === BEXAR) return /^\d{1,9}$/.test(id) ? { kind: 'direct', url: `https://hgo.harrisgovern.com/bexar/property/${TX_ROLL_YEAR}-${id}`, label: 'Bexar CAD property search' } : null;
  const e = coNo != null ? TX_BIS_HOSTS[coNo] : undefined;
  if (!e || !/^\d{1,9}$/.test(id)) return null;
  return { kind: 'direct', url: `https://${e.host}/Property/View/${id}`, label: `${e.name} CAD property search` };
}
