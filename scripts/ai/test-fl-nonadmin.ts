// Florida as a regular (non-admin) paying user: the REAL search/export handlers against the dev DB with a stubbed sign-in. Writes only the daily search count.
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-fl-nonadmin.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  const user = (await pool.query("select u.id, u.clerk_id, u.subscription_tier from users u where coalesce(u.role,'user')<>'admin' and u.clerk_id is not null and exists (select 1 from user_county_access a where a.user_id=u.id) order by u.id limit 1")).rows[0];
  if (!user) { console.log('FAIL  no non-admin test user with counties'); process.exit(1); }
  const owned: string[] = (await pool.query('select county from user_county_access where user_id=$1', [user.id])).rows.map((r: any) => r.county);
  const search = await import('../../app/api/parcels/search/route');
  const exportRoute = await import('../../app/api/parcels/export/route');
  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const post = async (route: any, body: any) => { const res = await route.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); const t = await res.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* csv */ } return { status: res.status, json: j }; };
  const S = (b: any) => post(search, b);
  const counties = (r: any) => [...new Set((r.json?.list || []).map((x: any) => x.county))];
  const mine = owned[0];
  const other = ['Hillsborough', 'Orange', 'Miami-Dade', 'Duval', 'Clay'].find((c) => !owned.includes(c))!;

  as(user.clerk_id);
  let r = await S({ counties: [mine], acreageMin: 1, limit: 200 });
  check(`own county (${mine}) returns rows, all in that county`, r.status === 200 && r.json.list.length > 0 && counties(r).length === 1 && counties(r)[0] === mine, `${r.status} ${r.json?.list?.length} rows`);
  check('result rows carry the screen fields', ['parcel_key', 'owner_name', 'acreage', 'market_value', 'latitude', 'longitude', 'is_lead', 'has_note'].every((f) => f in (r.json.list[0] || {})), Object.keys(r.json.list[0] || {}).length + ' fields');
  r = await S({ counties: [other], acreageMin: 1, limit: 200 });
  check(`county not on the plan (${other}) returns nothing`, r.status === 200 && (r.json?.count ?? 0) === 0, `${r.status} count ${r.json?.count}`);
  r = await S({ counties: [mine, other], acreageMin: 1, limit: 200 });
  check('mixed own + other county returns only the own one', r.status === 200 && counties(r).every((c) => c === mine) && r.json.list.length > 0, JSON.stringify(counties(r)));
  r = await S({ limit: 200 });
  check('no filters shows only the plan counties (nothing from other counties)', r.status === 200 && counties(r).every((c) => owned.includes(c as string)), JSON.stringify(counties(r)));
  r = await S({ acreageMin: 5, limit: 200 });
  check('filter with no county only searches the plan counties', r.status === 200 && counties(r).every((c) => owned.includes(c as string)), JSON.stringify(counties(r)));
  // A drawn box over Tampa (Hillsborough) must not leak parcels from a county the plan does not include.
  const ring = [[-82.55, 27.9], [-82.4, 27.9], [-82.4, 28.0], [-82.55, 28.0], [-82.55, 27.9]];
  r = await S({ spatialShape: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }, minLat: 27.9, maxLat: 28.0, minLon: -82.55, maxLon: -82.4, limit: 500 });
  check('drawn box over a county not on the plan leaks nothing', r.status === 200 && counties(r).every((c) => owned.includes(c as string)), `${r.json?.count} rows ${JSON.stringify(counties(r))}`);
  r = await S({ counties: [mine], absentee: true, vacantOnly: undefined, acreageMin: 1, limit: 100 });
  check('absentee seller signal works for a paid plan', r.status === 200 && r.json.list.length > 0 && r.json.list.every((x: any) => x.is_absentee === true), `${r.status} ${r.json?.list?.length}`);
  r = await S({ state: 'TX', counties: ['Bexar'], acreageMin: 1 });
  check('Texas pilot is closed to non-admins (403)', r.status === 403 && r.json?.error === 'state_not_available', `${r.status}`);
  r = await S({ state: 'NC', counties: ['Dare'], acreageMin: 1 });
  check('North Carolina pilot is closed to non-admins (403)', r.status === 403, `${r.status}`);
  r = await S({ counties: [mine], limit: 99999 });
  check('over-limit request is rejected, not run', r.status === 400, `${r.status}`);
  r = await post(exportRoute, { state: 'TX', counties: ['Bexar'] });
  check('Texas export refused', r.status === 400 || r.status === 403, `${r.status}`);
  // search counter (records only): a search by this user bumps today's count
  { const read = async () => Number((await pool.query('select coalesce(sum(count),0) n from user_usage_searches where user_id=$1 and date=current_date', [user.id])).rows[0].n);
    const c0 = await read(); await S({ counties: [mine], acreageMin: 1, limit: 5 }); await new Promise((res) => setTimeout(res, 800)); const c1 = await read();
    check('each search adds 1 to the account’s daily search count', c1 === c0 + 1, `${c0} -> ${c1}`); }
  as(null);
  r = await S({ counties: [mine], acreageMin: 1 });
  check('signed out -> 401', r.status === 401, `${r.status}`);
  r = await post(exportRoute, { counties: [mine], acreageMin: 1 });
  check('signed out export -> 401', r.status === 401, `${r.status}`);

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
