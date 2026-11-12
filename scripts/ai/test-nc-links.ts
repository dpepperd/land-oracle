// Unit checks for lib/ncCountyLinks.ts (pure, no network). Run: npx tsx scripts/ai/test-nc-links.ts
import { ncCountyLink, NC_LINKS } from '../../lib/ncCountyLinks';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
};

eq('Wake direct', ncCountyLink(183, { parcel_id: '0795212345', alt_key: '0295458' })?.url, 'https://services.wake.gov/realestate/Account.asp?id=0295458');
eq('Buncombe direct', ncCountyLink(21, { parcel_id: '972001824300000', alt_key: '972001824300000' })?.url, 'https://tax.buncombenc.gov/Parcel/Details/972001824300000');
eq('Durham direct', ncCountyLink(63, { parcel_id: 'x', alt_key: '139751' })?.url, 'https://taxcama.dconc.gov/camapwa/PropertySummary.aspx?REID=139751');
eq('Randolph direct', ncCountyLink(151, { alt_key: '13405' })?.url, 'https://txpwa.randolphcountync.gov/camapwa/PropertySummary.aspx?REID=13405');
eq('Gaston direct', ncCountyLink(71, { alt_key: '203529' })?.url, 'https://gastonnc.devnetwedge.com/parcel/view/203529/2026');
eq('Wake missing id -> null', ncCountyLink(183, { parcel_id: '1', alt_key: null }), null);
eq('Wake bad id (injection) -> null', ncCountyLink(183, { alt_key: '1&x=<script>' }), null);
eq('Buncombe dashed id -> null', ncCountyLink(21, { parcel_id: '9720-01-82' }), null);
eq('search copies parcel_id', ncCountyLink(119, { parcel_id: '12345678' }), { url: 'https://polaris3g.mecklenburgcountync.gov/', kind: 'search', copy: '12345678', label: 'Mecklenburg County Polaris' });
eq('search copies alt_key', ncCountyLink(25, { parcel_id: 'a', alt_key: '08-021A-0024.00' })?.copy, '08-021A-0024.00');
eq('search missing id -> null', ncCountyLink(119, {}), null);
eq('unlisted county -> null', ncCountyLink(43, { parcel_id: '1', alt_key: '1' }), null);
eq('no co_no -> null', ncCountyLink(null, { parcel_id: '1' }), null);
const bad = Object.entries(NC_LINKS).filter(([k]) => !(+k >= 1 && +k <= 199 && +k % 2 === 1)).map(([k]) => k);
eq('all keys are valid NC FIPS (odd 1..199)', bad, []);
const nonHttps = Object.entries(NC_LINKS).filter(([, e]) => e.kind === 'search' && !e.url.startsWith('https://')).map(([k]) => k);
eq('search urls are https', nonHttps, []);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
