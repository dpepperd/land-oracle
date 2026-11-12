// Runs the real POST handler of /api/parcels/search (dev DB, stubbed sign-in) with a drawn-area search and prints which counties come back.
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-search-area.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const ring = [[-81.40, 30.20], [-81.30, 30.20], [-81.30, 30.28], [-81.40, 30.28], [-81.40, 30.20]]; // around Ponte Vedra Beach (St. Johns County)
const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };

const run = async (route: any, label: string, body: any) => {
  const t = Date.now();
  const res = await route.POST(new Request('http://localhost/api/parcels/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const j: any = await res.json();
  const byCounty: Record<string, number> = {};
  (j.list || []).forEach((r: any) => { byCounty[r.county] = (byCounty[r.county] || 0) + 1; });
  console.log(`${label}: status ${res.status}, ${j.count ?? 0} results in ${Date.now() - t}ms, counties ${JSON.stringify(byCounty)}${j.error ? ' error=' + j.error : ''}`);
};

(async () => {
  const { default: pool } = await import('../../lib/db');
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  process.env.TEST_CLERK_ID = admin.clerk_id;
  const route = await import('../../app/api/parcels/search/route');
  const base = { landUse: ['001'], marketValueMin: 500000, marketValueMax: 1200000, limit: 1000 };
  const bbox = { minLat: 30.20, maxLat: 30.28, minLon: -81.40, maxLon: -81.30 };

  await run(route, 'A drawn Feature polygon + bbox, no county', { ...base, ...bbox, spatialShape: feature });
  await run(route, 'B bare Polygon geometry + bbox, no county', { ...base, ...bbox, spatialShape: feature.geometry });
  await run(route, 'C bbox only (no shape), no county', { ...base, ...bbox });
  await run(route, 'D NO area at all, no county (what a dropped area would do)', { ...base });
  await run(route, 'E drawn polygon with counties=St. Johns', { ...base, ...bbox, counties: ['St. Johns'], spatialShape: feature });
  // what the browser really sends after Apply Filters (all sidebar fields, shape without 'properties')
  const clientShape = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-81.395, 30.215], [-81.33, 30.208], [-81.312, 30.25], [-81.35, 30.275], [-81.39, 30.262], [-81.395, 30.215]]] } };
  await run(route, 'F full client body + hand-drawn polygon', { counties: [], landUse: ['001'], marketValueMin: 500000, marketValueMax: 1200000, maxDistance: 0, ownerType: 'all', parcelId: '', address: '', limit: 1000, spatialShape: clientShape, minLat: 30.208, maxLat: 30.275, minLon: -81.395, maxLon: -81.312 });
  await run(route, 'G same but shape null + bbox kept', { counties: [], landUse: ['001'], marketValueMin: 500000, marketValueMax: 1200000, maxDistance: 0, ownerType: 'all', parcelId: '', address: '', limit: 1000, spatialShape: null, minLat: 30.208, maxLat: 30.275, minLon: -81.395, maxLon: -81.312 });
  await run(route, 'H shape kept but bbox zeros (clear-shape residue)', { counties: [], landUse: ['001'], marketValueMin: 500000, marketValueMax: 1200000, ownerType: 'all', limit: 1000, spatialShape: clientShape, minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 });
  await pool.end();
})().catch((e) => { console.error('CRASHED', e); process.exit(2); });
