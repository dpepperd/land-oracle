// Pure tests for lib/searchState.ts: Florida requests are unchanged; North Carolina requests carry the right fields. Usage:
//   npx tsx scripts/ai/test-search-state.ts
import { buildSearchBody, freshFilters, STATE_VIEW } from '../../lib/searchState';
import { withArea } from '../../lib/searchArea';
import assert from 'node:assert';

const out: string[] = [];
const t = (name: string, fn: () => void) => { try { fn(); out.push(`PASS  ${name}`); } catch (e: any) { out.push(`FAIL  ${name}  ${e.message}`); } };

const filters = { counties: ['Clay'], landUse: ['000', '010'], acreageMin: 5, ownerType: 'out_of_state', absentee: true, nonHomestead: true, maxDistance: 3, limit: 1000, noSaleYears: 5 };
const shape = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-81.4, 30.2], [-81.3, 30.2], [-81.3, 30.3], [-81.4, 30.3], [-81.4, 30.2]]] } };
const area = { shape, bounds: [30.2, 30.3, -81.4, -81.3] as [number, number, number, number] };

t('FL body is exactly what the dashboard sent before (no area)', () => assert.deepStrictEqual(buildSearchBody(filters, null, 'FL'), withArea(filters, null)));
t('FL body is exactly what the dashboard sent before (with area)', () => assert.deepStrictEqual(buildSearchBody(filters, area, 'FL'), withArea(filters, area)));
t('FL body has no "state" key at all', () => assert.ok(!('state' in buildSearchBody(filters, area, 'FL'))));
t('FL body keeps land use, homestead and highway filters', () => { const b = buildSearchBody(filters, null, 'FL'); assert.deepStrictEqual(b.landUse, ['000', '010']); assert.strictEqual(b.nonHomestead, true); assert.strictEqual(b.maxDistance, 3); });
t('NC body sets state NC', () => assert.strictEqual(buildSearchBody(filters, null, 'NC').state, 'NC'));
t('NC body drops Florida-only filters', () => { const b = buildSearchBody(filters, null, 'NC'); assert.ok(!('landUse' in b) && !('nonHomestead' in b) && !('maxDistance' in b)); });
t('NC body keeps counties, acreage, owner type, absentee, no-sale years, limit', () => { const b = buildSearchBody(filters, null, 'NC'); assert.deepStrictEqual([b.counties, b.acreageMin, b.ownerType, b.absentee, b.noSaleYears, b.limit], [['Clay'], 5, 'out_of_state', true, 5, 1000]); });
t('NC body carries the drawn area', () => { const b = buildSearchBody(filters, area, 'NC'); assert.deepStrictEqual([b.spatialShape, b.minLat, b.maxLon], [shape, 30.2, -81.3]); });
t('NC body carries vacantOnly', () => assert.strictEqual(buildSearchBody({ ...filters, vacantOnly: true }, null, 'NC').vacantOnly, true));
t('TX body sets state TX and drops Florida-only filters', () => { const b = buildSearchBody(filters, null, 'TX'); assert.ok(b.state === 'TX' && !('landUse' in b) && !('nonHomestead' in b) && !('maxDistance' in b)); });
t('TX map view is inside Texas', () => { assert.ok(STATE_VIEW.TX[0] < -93 && STATE_VIEW.TX[0] > -107 && STATE_VIEW.TX[1] > 26 && STATE_VIEW.TX[1] < 36); });
t('building a body never changes the filters object', () => { const copy = JSON.parse(JSON.stringify(filters)); buildSearchBody(filters, area, 'NC'); assert.deepStrictEqual(filters, copy); });
t('freshFilters is empty and keeps the limit', () => { const f = freshFilters(500); assert.deepStrictEqual([f.counties, f.landUse, f.limit, f.vacantOnly], [[], [], 500, undefined]); });
t('map views are inside each state', () => { assert.ok(STATE_VIEW.FL[0] < -80 && STATE_VIEW.FL[1] < 31); assert.ok(STATE_VIEW.NC[0] < -75 && STATE_VIEW.NC[1] > 33 && STATE_VIEW.NC[1] < 37); });

console.log(out.join('\n'));
process.exit(out.some((x) => x.startsWith('FAIL')) ? 1 : 0);
