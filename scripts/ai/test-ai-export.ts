// Runs the real POST handler of /api/assistant/export against the dev database with a stubbed sign-in. Usage:
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-ai-export.ts
// It restores the admin's export_usage row afterwards (the handler records exported rows).
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const call = async (route: any, keys: unknown, rawBody?: string) => {
  const res = await route.POST(new Request('http://localhost/api/assistant/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: rawBody ?? JSON.stringify({ keys }) }));
  const text = await res.text();
  return { status: res.status, type: res.headers.get('content-type'), disp: res.headers.get('content-disposition'), text };
};

(async () => {
  const { default: pool } = await import('../../lib/db');
  const admin = (await pool.query("select id, clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  const free = (await pool.query("select u.id, u.clerk_id from users u where coalesce(u.role,'user')<>'admin' and u.clerk_id is not null limit 1")).rows[0];
  const keys: string[] = (await pool.query("select parcel_key from parcels_current_all where county='Clay' and has_geom limit 5")).rows.map((r) => r.parcel_key);
  const leonKey: string = (await pool.query("select parcel_key from parcels_current_all where county='Leon' and has_geom limit 1")).rows[0].parcel_key;
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const before = (await pool.query('select rows from export_usage where user_id=$1 and month=$2', [admin.id, month])).rows[0]?.rows ?? null;

  const route = await import('../../app/api/assistant/export/route');
  const results: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

  // 1. unauthenticated
  delete process.env.TEST_CLERK_ID;
  let r = await call(route, keys);
  check('signed out -> 401', r.status === 401, `status ${r.status}`);

  // 2. admin, 5 real Clay keys
  process.env.TEST_CLERK_ID = admin.clerk_id;
  r = await call(route, keys);
  const lines = r.text.split('\n');
  check('admin: 200 CSV', r.status === 200 && (r.type || '').includes('text/csv'), `status ${r.status} ${r.type} ${r.disp}`);
  check('admin: header + 5 rows', lines.length === 6, `${lines.length} lines; header: ${lines[0].slice(0, 90)}...`);
  check('admin: keys match request', keys.every((k) => r.text.includes(k)), 'all 5 requested parcel_keys present');
  console.log('first data row:', lines[1].slice(0, 200));

  // 3. admin: invalid / empty-after-validation keys -> empty CSV, not an error
  r = await call(route, ['nope-not-a-key', 'XX-99-zzz']);
  check('admin: bad keys -> empty CSV', r.status === 200 && r.text === '', `status ${r.status} len ${r.text.length}`);

  // 4. too many keys / empty list / malformed JSON -> 400
  r = await call(route, Array.from({ length: 61 }, (_, i) => `FL-20-X${i}-ABCDE`));
  check('61 keys -> 400', r.status === 400, `status ${r.status}`);
  r = await call(route, []);
  check('empty list -> 400', r.status === 400, `status ${r.status}`);
  r = await call(route, null, '{not json');
  check('bad JSON -> 400', r.status === 400, `status ${r.status}`);

  // 5. non-admin user: county entitlement (Leon should be denied unless their plan includes it)
  if (free) {
    process.env.TEST_CLERK_ID = free.clerk_id;
    const entCounties = (await pool.query('select county from user_county_access where user_id=$1', [free.id])).rows.map((x) => x.county);
    r = await call(route, [leonKey]);
    const denied = r.status === 200 && r.text === '' || r.status === 402 || r.status === 403;
    check(`non-admin (counties: ${entCounties.join('/') || 'none'}): Leon denied`, entCounties.includes('Leon') ? true : denied, `status ${r.status} len ${r.text.length}`);
  } else results.push('SKIP  no non-admin user in dev DB');

  // 6. non-admin inside their counties: rows returned and counted; then over the monthly limit: refused with 402
  if (free) {
    process.env.TEST_CLERK_ID = free.clerk_id;
    const { getEntitlements } = await import('../../lib/entitlements');
    const ent = await getEntitlements(free.clerk_id);
    const u0 = (await pool.query('select rows from export_usage where user_id=$1 and month=$2', [free.id, month])).rows[0]?.rows ?? null;
    if (ent.counties !== 'all' && ent.counties.some((c) => c.toLowerCase() === 'clay') && ent.exports.limit !== 'unlimited') {
      r = await call(route, [keys[0]]);
      const nrows = r.text ? r.text.split('\n').length - 1 : 0;
      const u1 = Number((await pool.query('select rows from export_usage where user_id=$1 and month=$2', [free.id, month])).rows[0]?.rows ?? 0);
      check('non-admin in-county: 1 row, usage counted', r.status === 200 && nrows === 1 && u1 === (u0 ?? 0) + 1, `status ${r.status} rows ${nrows} usage ${u0 ?? 0} -> ${u1}`);
      await pool.query('insert into export_usage (user_id, month, rows) values ($1,$2,$3) on conflict (user_id, month) do update set rows=$3', [free.id, month, ent.exports.limit]);
      r = await call(route, [keys[0]]);
      check('non-admin over limit -> 402', r.status === 402 && r.text.includes('export_cap_reached'), `status ${r.status} ${r.text.slice(0, 80)}`);
    } else results.push('SKIP  non-admin test user has no Clay or has unlimited exports (tier ' + ent.tier + ')');
    if (u0 === null) await pool.query('delete from export_usage where user_id=$1 and month=$2', [free.id, month]);
    else await pool.query('update export_usage set rows=$3 where user_id=$1 and month=$2', [free.id, month, u0]);
  }

  console.log(results.join('\n'));

  // restore export_usage for the admin
  if (before === null) await pool.query('delete from export_usage where user_id=$1 and month=$2', [admin.id, month]);
  else await pool.query('update export_usage set rows=$3 where user_id=$1 and month=$2', [admin.id, month, before]);
  console.log('export_usage restored for admin (before:', before, ')');
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(2); });
