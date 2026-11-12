// Runs the REAL POST handlers (/api/parcels/search and /api/parcels/export) against the dev DB with a stubbed sign-in:
// the admin-only North Carolina path, the admin gate, and Florida regressions (county names that exist in both states). Read-only.
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-nc-search.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { absenteeSqlFor } from '../../lib/sellerSignals';
import { ncCountyCode, ncCountyName, NC_COUNTIES } from '../../lib/ncStates';

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  const user = (await pool.query("select clerk_id from users where coalesce(role,'user')<>'admin' and clerk_id is not null limit 1")).rows[0];
  const search = await import('../../app/api/parcels/search/route');
  const exportRoute = await import('../../app/api/parcels/export/route');
  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const post = async (route: any, url: string, body: any) => {
    const res = await route.POST(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* csv */ }
    return { status: res.status, json, text };
  };
  const S = (b: any) => post(search, 'http://localhost/api/parcels/search', b);
  const keysOf = (r: any) => (r.json?.list || []).map((x: any) => x.parcel_key as string);

  // ---- helper
  check('county list has 100 NC counties', NC_COUNTIES.length === 100, String(NC_COUNTIES.length));
  check('ncCountyCode Clay=43, McDowell=111, "mcdowell county"=111, New Hanover=129', ncCountyCode('Clay') === 43 && ncCountyCode('McDowell') === 111 && ncCountyCode('mcdowell county') === 111 && ncCountyCode('New Hanover') === 129 && ncCountyName(43) === 'Clay', 'ok');

  // ---- admin NC search by county
  as(admin.clerk_id);
  let r = await S({ state: 'NC', counties: ['Clay'], acreageMin: 0.01, limit: 500 });
  const k = keysOf(r);
  check('NC Clay (admin): rows, all NC Clay', r.status === 200 && k.length > 0 && k.every((x: string) => x.startsWith('NC-043-')) && r.json.list.every((x: any) => x.county === 'Clay' && x.state === 'NC'), `status ${r.status}, ${k.length} rows, first ${k[0]}`);
  check('NC keys unique in results', new Set(k).size === k.length, `${k.length} rows`);
  check('NC Clay acreage was missing in the state data: now derived from the outline and labelled', r.json.list.every((x: any) => Number(x.acreage) > 0 && x.acreage_source === 'shape'), `first ${r.json.list[0].acreage} ac (${r.json.list[0].acreage_source})`);
  check('NC results all drawable on the map', r.json.geojson.features.length === r.json.list.length, `${r.json.geojson.features.length}/${r.json.list.length}`);
  check('NC result has the fields the screen needs', ['id', 'parcel_key', 'owner_name', 'owner_address', 'owner_state', 'acreage', 'land_use', 'market_value', 'out_of_state', 'has_outline', 'latitude', 'longitude', 'flood_lat', 'is_lead', 'has_note'].every((f) => f in r.json.list[0]), Object.keys(r.json.list[0]).length + ' fields');
  check('NC response carries the NC OneMap credit', typeof r.json.credit === 'string' && r.json.credit.includes('NC OneMap'), r.json.credit?.slice(0, 40));

  // ---- Florida regressions: same county NAMES exist in NC
  for (const county of ['Clay', 'Washington', 'Jefferson']) {
    r = await S({ counties: [county], landUse: ['001'], limit: 200 });
    const fk = keysOf(r);
    check(`FL ${county} (no state): only Florida rows`, r.status === 200 && fk.length > 0 && fk.every((x: string) => x.startsWith('FL-')), `${fk.length} rows, first ${fk[0]}`);
  }
  r = await S({ state: 'FL', counties: ['Clay'], landUse: ['001'], limit: 50 });
  check('FL explicit state=FL: only Florida rows', r.status === 200 && keysOf(r).every((x: string) => x.startsWith('FL-')), `${keysOf(r).length} rows`);

  // ---- gate
  as(user.clerk_id);
  r = await S({ state: 'NC', counties: ['Clay'], acreageMin: 1 });
  check('NC non-admin: refused 403 state_not_available', r.status === 403 && r.json?.error === 'state_not_available', `status ${r.status}`);
  r = await S({ counties: ['Clay'], landUse: ['001'], limit: 10 });
  check('FL non-admin still works', r.status === 200, `status ${r.status}`);
  as(null);
  r = await S({ state: 'NC', counties: ['Clay'], acreageMin: 1 });
  check('NC signed out: 401', r.status === 401, `status ${r.status}`);
  as(admin.clerk_id);

  // ---- edge cases
  r = await S({ state: 'NC', counties: ['Atlantis'], acreageMin: 1 });
  check('NC unknown county: empty, no error', r.status === 200 && r.json.count === 0, `status ${r.status}`);
  r = await S({ state: 'NC' });
  check('NC no county/area/filter: empty (same rule as Florida)', r.status === 200 && r.json.count === 0, `status ${r.status}`);

  // ---- filters
  r = await S({ state: 'NC', counties: ['Dare'], ownerType: 'out_of_state', vacantOnly: true, acreageMin: 10, limit: 300 });
  const rows = r.json.list;
  check('NC Dare out-of-state + likely-vacant + >=10 acres', r.status === 200 && rows.length > 0 && rows.every((x: any) => x.owner_state && x.owner_state !== 'NC' && x.likely_vacant === true && Number(x.acreage) >= 10), `${rows.length} rows`);
  r = await S({ state: 'NC', counties: ['Wake'], marketValueMin: 500000, marketValueMax: 700000, limit: 300 });
  check('NC Wake value $500K-$700K', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => Number(x.market_value) >= 500000 && Number(x.market_value) <= 700000), `${r.json.list.length} rows`);
  r = await S({ state: 'NC', counties: ['Wake'], marketValueMin: 2000000, limit: 100 });
  check('NC min-only value filter works (the earlier bug class)', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => Number(x.market_value) >= 2000000), `${r.json.list.length} rows`);

  // Wake and other counties stored "CITY ST ZIP" inside the city field, so owner state was empty and out-of-state owners were invisible
  const byCounty: Record<string, number> = {}; let allOutOfState = true;
  for (const c of ['Wake', 'Haywood', 'Chatham', 'Yancey']) {
    const rc = await S({ state: 'NC', counties: [c], ownerType: 'out_of_state', limit: 300 });
    byCounty[c] = rc.json.list.length;
    if (!rc.json.list.every((x: any) => x.owner_state && x.owner_state !== 'NC')) allOutOfState = false;
  }
  check('NC out-of-state owners are found in Wake, Haywood, Chatham and Yancey (owner state parsed)', allOutOfState && Object.values(byCounty).every((n) => n > 50), JSON.stringify(byCounty));

  // absentee must be state-aware: NC owners living in NC are NOT automatically absentee
  const ab = (await pool.query(`select count(*) total, count(*) filter (where ${absenteeSqlFor('NC')}) absentee, count(*) filter (where ${absenteeSqlFor('FL')}) wrong_fl_rule from parcels_nc_current p where p.co_no = 183`)).rows[0];
  const ratio = Number(ab.absentee) / Number(ab.total), wrong = Number(ab.wrong_fl_rule) / Number(ab.total);
  check('NC absentee is state-aware (Wake)', ratio > 0.1 && ratio < 0.6 && wrong > ratio, `NC rule ${(ratio * 100).toFixed(0)}% vs wrong FL rule ${(wrong * 100).toFixed(0)}% of ${ab.total}`);
  r = await S({ state: 'NC', counties: ['Wake'], absentee: true, limit: 200 });
  check('NC absentee filter returns only absentee rows', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => x.is_absentee === true), `${r.json.list.length} rows`);

  // ---- drawn areas
  const raleigh = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-78.66, 35.77], [-78.62, 35.77], [-78.62, 35.79], [-78.66, 35.79], [-78.66, 35.77]]] } };
  r = await S({ state: 'NC', spatialShape: raleigh, minLat: 35.77, maxLat: 35.79, minLon: -78.66, maxLon: -78.62, limit: 500 });
  check('NC drawn area downtown Raleigh: only Wake', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => x.county === 'Wake'), `${r.json.list.length} rows`);
  const circle = { type: 'Feature', properties: { subType: 'Circle', radius: 1 }, geometry: { type: 'Point', coordinates: [-80.84, 35.23] } };
  r = await S({ state: 'NC', spatialShape: circle, limit: 500 });
  check('NC circle area near Charlotte: only Mecklenburg', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => x.county === 'Mecklenburg'), `${r.json.list.length} rows`);

  // ---- text search
  const sample = (await pool.query(`select parcel_id, phy_addr1 from parcels_nc_current where co_no = 55 and parcel_id is not null and phy_addr1 is not null and length(phy_addr1) > 8 limit 1`)).rows[0];
  r = await S({ state: 'NC', counties: ['Dare'], parcelId: sample.parcel_id });
  check('NC parcel ID search finds it', r.status === 200 && r.json.list.some((x: any) => x.parcel_id === sample.parcel_id), `${r.json.list.length} rows for ${sample.parcel_id}`);
  r = await S({ state: 'NC', counties: ['Dare'], address: sample.phy_addr1.slice(0, 8) });
  check('NC address search finds rows containing it', r.status === 200 && r.json.list.length > 0, `${r.json.list.length} rows for "${sample.phy_addr1.slice(0, 8)}"`);
  r = await S({ state: 'NC', parcelId: '123' });
  check('NC ID search without a county: 400 county_required', r.status === 400 && r.json?.error === 'county_required', `status ${r.status}`);

  // ---- export guard + Florida export unchanged
  let e = await post(exportRoute, 'http://localhost/api/parcels/export', { state: 'NC', counties: ['Clay'], acreageMin: 1 });
  check('export with state NC: refused 400 (never exports Florida data)', e.status === 400 && e.json?.error === 'state_export_not_available', `status ${e.status}`);

  console.log(results.join('\n'));
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('CRASHED', e); process.exit(2); });
