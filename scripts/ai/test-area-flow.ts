// Simulates the dashboard's area/filter state flow with lib/searchArea.ts and sends each resulting request to the REAL search handler
// (dev DB, stubbed sign-in). Usage:
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-area-flow.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { withArea, stripArea, type SearchArea } from '../../lib/searchArea';

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  process.env.TEST_CLERK_ID = admin.clerk_id;
  const route = await import('../../app/api/parcels/search/route');
  const send = async (body: any) => {
    const res = await route.POST(new Request('http://localhost/api/parcels/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const j: any = await res.json(); const by: Record<string, number> = {};
    (j.list || []).forEach((r: any) => { by[r.county] = (by[r.county] || 0) + 1; });
    return { status: res.status, count: j.count ?? 0, by };
  };

  // --- state as in the dashboard page
  let filters: any = { counties: [], landUse: [], ownerType: 'all', parcelId: '', limit: 1000 };
  let area: SearchArea | null = null;
  const shape = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-81.395, 30.215], [-81.33, 30.208], [-81.312, 30.25], [-81.35, 30.275], [-81.39, 30.262], [-81.395, 30.215]]] } };

  // 1. user draws the area and clicks APPLY SEARCH AREA
  area = { shape, bounds: [30.208, 30.275, -81.395, -81.312] };
  let r = await send(withArea(filters, area));
  check('1. area applied: only St. Johns/Duval', r.status === 200 && r.count > 0 && Object.keys(r.by).every((c) => ['Saint Johns', 'Duval'].includes(c)), JSON.stringify(r.by));

  // 2. sidebar: user picks single family + $500K-$1.2M, clicks Apply Filters (handleApply merges area from props, then page strips it)
  const sidebarLocal = { ...filters, landUse: ['001'], marketValueMin: 500000, marketValueMax: 1200000 };
  const initialFilters = withArea(filters, area);               // what the sidebar receives as props
  const toApply = { ...sidebarLocal, spatialShape: (initialFilters as any).spatialShape || (sidebarLocal as any).spatialShape, minLat: (initialFilters as any).minLat || (sidebarLocal as any).minLat };
  filters = stripArea(toApply);                                 // page: onFilterChange
  check('2a. page filters hold no area keys', !('spatialShape' in filters) && !('minLat' in filters), JSON.stringify(Object.keys(filters)));
  r = await send(withArea(filters, area));
  check('2b. Apply Filters keeps the area (the reported bug)', r.status === 200 && r.count > 0 && !('Miami-Dade' in r.by), `${r.count} results ${JSON.stringify(r.by)}`);

  // 3. even if the sidebar sends a stale/empty area, the page's own area wins
  const stale = { ...filters, spatialShape: null, minLat: undefined };
  r = await send(withArea(stripArea(stale), area));
  check('3. stale sidebar state cannot drop the area', r.status === 200 && !('Miami-Dade' in r.by) && r.count > 0, `${r.count} results ${JSON.stringify(r.by)}`);

  // 4. Clear Shape / Reset: area gone, request has no area keys set
  area = null;
  const cleared = withArea(filters, area);
  check('4a. cleared: no area in request', (cleared as any).spatialShape === null && (cleared as any).minLat === undefined, 'spatialShape null, bbox undefined');
  r = await send(cleared);
  check('4b. cleared + no county = statewide (UI shows the notice)', r.status === 200 && r.count > 0, `${r.count} results ${JSON.stringify(r.by)}`);

  // 5. circle-type shapes keep working through the same path
  const circle = { type: 'Feature', properties: { subType: 'Circle', radius: 2 }, geometry: { type: 'Point', coordinates: [-81.36, 30.24] } };
  r = await send(withArea({ ...filters }, { shape: circle, bounds: [30.2, 30.28, -81.4, -81.32] }));
  check('5. circle area works', r.status === 200 && r.count > 0 && !('Miami-Dade' in r.by), `${r.count} results ${JSON.stringify(r.by)}`);

  console.log(results.join('\n'));
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('CRASHED', e); process.exit(2); });
