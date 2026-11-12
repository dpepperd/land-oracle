// Runs the REAL POST handlers against the dev DB with a stubbed sign-in: admin-only Texas search, gate, export refusal. Read-only.
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-tx-search.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { txCountyCode, txCountyName, TX_COUNTIES } from '../../lib/txStates';

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
    return { status: res.status, json };
  };
  const S = (b: any) => post(search, 'http://localhost/api/parcels/search', b);
  const keysOf = (r: any) => (r.json?.list || []).map((x: any) => x.parcel_key as string);

  check('county list has 253 TX counties', TX_COUNTIES.length === 253, String(TX_COUNTIES.length));
  check('txCountyCode Harris=201, Travis=453, Bexar=29, "harris county"=201', txCountyCode('Harris') === 201 && txCountyCode('Travis') === 453 && txCountyCode('Bexar') === 29 && txCountyCode('harris county') === 201 && txCountyName(201) === 'Harris', 'ok');

  as(admin.clerk_id);
  for (const [name, code] of [['Harris', 201], ['Travis', 453], ['Bexar', 29], ['Robertson', 395]] as const) {
    const r = await S({ state: 'TX', counties: [name], acreageMin: 0.01, limit: 300 });
    const k = keysOf(r);
    const pre = 'TX-' + String(code).padStart(3, '0') + '-';
    check(`TX ${name} (admin): rows, all TX ${name}`, r.status === 200 && k.length > 0 && k.every((x: string) => x.startsWith(pre)) && r.json.list.every((x: any) => x.county === name && x.state === 'TX'), `status ${r.status}, ${k.length} rows, first ${k[0]}`);
    check(`TX ${name} keys unique`, new Set(k).size === k.length, `${k.length}`);
    if (name === 'Harris') {
      check('TX result has screen fields', ['id', 'parcel_key', 'owner_name', 'acreage', 'land_use', 'market_value', 'out_of_state', 'latitude', 'longitude', 'is_lead'].every((f) => f in r.json.list[0]), Object.keys(r.json.list[0]).length + ' fields');
      check('TX response carries a credit', typeof r.json.credit === 'string' && r.json.credit.length > 0, String(r.json.credit).slice(0, 50));
    }
  }
  let r = await S({ state: 'TX', counties: ['Bexar'], likelyVacant: true, limit: 200 });
  check('TX vacant filter works', r.status === 200 && r.json.list.length > 0, `status ${r.status}, ${r.json?.list?.length} rows`);
  r = await S({ state: 'TX', counties: ['Harris'], noSaleYears: 5, limit: 50 });
  check('TX ignores no-sale filter (no sale dates)', r.status === 200 && r.json.list.length > 0, `status ${r.status}`);
  r = await S({ state: 'TX', counties: ['Harris'], limit: 5 });
  const id = r.json.list[0]?.parcel_id;
  if (id) { const r2 = await S({ state: 'TX', counties: ['Harris'], parcelId: id, limit: 5 }); check('TX id search finds the parcel', r2.status === 200 && r2.json.list.length >= 1, `id ${id}, ${r2.json?.list?.length} rows, status ${r2.status}`); }
  // Florida unaffected
  r = await S({ counties: ['Clay'], landUse: ['001'], limit: 50 });
  check('FL (no state) still Florida only', r.status === 200 && keysOf(r).length > 0 && keysOf(r).every((x: string) => x.startsWith('FL-')), `${keysOf(r).length} rows`);
  r = await post(exportRoute, 'http://localhost/api/parcels/export', { state: 'TX', counties: ['Harris'] });
  check('export with state TX: refused 400', r.status === 400, `status ${r.status}`);

  as(user.clerk_id);
  r = await S({ state: 'TX', counties: ['Harris'], acreageMin: 1 });
  check('TX non-admin: 403 state_not_available', r.status === 403 && r.json?.error === 'state_not_available', `status ${r.status}`);
  as(null);
  r = await S({ state: 'TX', counties: ['Harris'], acreageMin: 1 });
  check('TX signed out: 401', r.status === 401, `status ${r.status}`);

  console.log(results.join('\n'));
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('CRASHED', e); process.exit(2); });
