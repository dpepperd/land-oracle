// Texas county links: shape rules (no network). The live check against real parcels is documented in docs/texas-pilot.md.
import assert from 'assert';
import { txCountyLink, TX_BIS_HOSTS } from '../../lib/txCountyLinks';
import { ncLinkNotice } from '../../lib/ncCountyLinks';
import { TX_COUNTIES } from '../../lib/txStates';
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log('PASS ', n); } catch (e: any) { fails++; console.log('FAIL ', n, e.message); } };
const codes = new Set(TX_COUNTIES.map(([c]) => c));
t('every linked county is a real Texas county', () => assert.ok(Object.keys(TX_BIS_HOSTS).every((c) => codes.has(Number(c)))));
t('hosts are esearch.* with no scheme or path', () => assert.ok(Object.values(TX_BIS_HOSTS).every((e) => /^esearch\.[a-z0-9.-]+$/.test(e.host))));
t('Taylor (441) opens the parcel', () => assert.strictEqual(txCountyLink(441, { parcel_id: '10001' })?.url, 'https://esearch.taylor-cad.org/Property/View/10001'));
t('link is direct and has a notice', () => { const l = txCountyLink(441, { parcel_id: '10001' })!; assert.strictEqual(l.kind, 'direct'); assert.ok(/opens that parcel/.test(ncLinkNotice(l))); });
t('county with no entry (Harris 201) -> null', () => assert.strictEqual(txCountyLink(201, { parcel_id: '123' }), null));
t('missing / non-numeric id -> null', () => { assert.strictEqual(txCountyLink(441, { parcel_id: null }), null); assert.strictEqual(txCountyLink(441, { parcel_id: '12-3' }), null); assert.strictEqual(txCountyLink(441, { parcel_id: '' }), null); });
t('null county -> null', () => assert.strictEqual(txCountyLink(null, { parcel_id: '1' }), null));
t('unverified counties are not listed (Bosque 35, Orange 361, Terrell 443)', () => assert.ok(![35, 361, 443].some((c) => c in TX_BIS_HOSTS)));
process.exit(fails ? 1 : 0);
