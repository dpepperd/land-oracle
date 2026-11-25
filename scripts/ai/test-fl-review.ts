// Fixes from the Florida code review, on the REAL route handlers with a stubbed sign-in, on the DEV database. Throwaway rows are removed afterwards.
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-fl-review.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  const search = await import('../../app/api/parcels/search/route');
  const exportRoute = await import('../../app/api/parcels/export/route');
  const leadsRoute = await import('../../app/api/leads/create/route');
  const notesRoute = await import('../../app/api/notes/save/route');
  const countiesRoute = await import('../../app/api/user/counties/route');
  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const call = async (fn: (r: Request) => Promise<Response>, body: any, raw = false) => {
    const res = await fn(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) }));
    const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  };

  const main = (await pool.query("select u.id, u.clerk_id from users u where coalesce(u.role,'user')<>'admin' and u.clerk_id is not null and exists (select 1 from user_county_access a where a.user_id=u.id and a.county='Clay') and exists (select 1 from user_county_access a where a.user_id=u.id and a.county='Duval') order by u.id limit 1")).rows[0];
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  const tag = 'test_flreview_' + Date.now();
  const second = (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id, clerk_id", [tag, tag + '@example.invalid'])).rows[0];
  const pk: string = (await pool.query("select parcel_key from parcels_current_all where county='Clay' and has_geom and own_name is not null limit 1")).rows[0].parcel_key;
  const cleanup = async () => {
    await pool.query('delete from leads where user_id = $1 and parcel_key = $2', [main.id, pk]);
    await pool.query("delete from user_parcel_notes where user_id = $1 and content like 'test_flreview_%'", [main.id]);
    await pool.query('delete from user_county_access where user_id = $1', [second.id]);
    await pool.query('delete from users where id = $1', [second.id]);
  };

  try {
    as(main.clerk_id);
    // ---- 1. text search: minimum length, wildcards literal
    let r = await call(search.POST, { counties: ['Duval'], parcelId: '1', limit: 100 });
    check('parcel ID of 1 character is refused with a plain message (no heavy query)', r.status === 400 && r.json?.error === 'text_too_short' && /at least 3/.test(r.json.message), `${r.status} ${r.json?.error}`);
    r = await call(search.POST, { counties: ['Duval'], address: 'ab', limit: 100 });
    check('address of 2 characters is refused', r.status === 400 && r.json?.error === 'text_too_short', `${r.status}`);
    r = await call(search.POST, { counties: ['Duval'], parcelId: '%', limit: 100 });
    check('a lone % is refused (it used to match every parcel)', r.status === 400 && r.json?.error === 'text_too_short', `${r.status}`);
    r = await call(search.POST, { counties: ['Duval'], parcelId: '%%%', limit: 100 });
    check('%%% is now taken literally: matches nothing instead of everything', r.status === 200 && (r.json?.count ?? 0) === 0, `${r.status} count ${r.json?.count}`);
    r = await call(search.POST, { counties: ['Duval'], address: '___', limit: 100 });
    check('___ is taken literally: matches nothing', r.status === 200 && (r.json?.count ?? 0) === 0, `${r.status} count ${r.json?.count}`);
    r = await call(search.POST, { counties: ['Duval'], parcelId: '1234', limit: 100 });
    check('a normal 4-character parcel ID search still works', r.status === 200 && r.json.count > 0, `${r.status} count ${r.json?.count}`);
    const addr = (await pool.query("select phy_addr1 from parcels_current_all where county='Clay' and phy_addr1 ~ '^[0-9]+ [A-Z]+' limit 1")).rows[0]?.phy_addr1 as string;
    r = await call(search.POST, { counties: ['Clay'], address: addr.slice(0, 8), limit: 100 });
    check('a normal address search still works', r.status === 200 && r.json.count > 0, `${addr.slice(0, 8)} -> ${r.json?.count}`);
    r = await call(exportRoute.POST, { counties: ['Duval'], parcelId: '1' });
    check('export refuses a 1-character text search too (and uses no export rows)', r.status === 400 && r.json?.error === 'text_too_short', `${r.status}`);
    as(admin.clerk_id);
    r = await call(search.POST, { state: 'TX', counties: ['Bexar'], parcelId: 'ab' });
    check('Texas pilot search refuses short text too', r.status === 400 && r.json?.error === 'text_too_short', `${r.status}`);
    r = await call(search.POST, { state: 'TX', counties: ['Bexar'], parcelId: '%%%' });
    check('Texas pilot takes wildcards literally', r.status === 200 && (r.json?.count ?? 0) === 0, `${r.status} count ${r.json?.count}`);

    // ---- 2. a drawn circle with no centre is a clear 400, not a 500 with internals
    as(main.clerk_id);
    r = await call(search.POST, { counties: ['Clay'], spatialShape: { type: 'Feature', properties: { subType: 'Circle', radius: 1 } } });
    check('circle without a centre: 400 invalid_area, no internal error text', r.status === 400 && r.json?.error === 'invalid_area' && !/Cannot read|undefined/.test(r.text), `${r.status} ${r.text.slice(0, 80)}`);
    as(admin.clerk_id);
    r = await call(search.POST, { state: 'TX', counties: ['Bexar'], spatialShape: { type: 'Feature', properties: { subType: 'Circle', radius: 1 } } });
    check('same for the Texas pilot search', r.status === 400 && r.json?.error === 'invalid_area', `${r.status}`);

    // ---- 3. leads are idempotent, and duplicates can never show a parcel twice
    as(main.clerk_id);
    await pool.query('delete from leads where user_id = $1 and parcel_key = $2', [main.id, pk]);
    const l1 = await call(leadsRoute.POST, { parcel_key: pk });
    const l2 = await call(leadsRoute.POST, { parcel_key: pk });
    const n = Number((await pool.query('select count(*) n from leads where user_id=$1 and parcel_key=$2', [main.id, pk])).rows[0].n);
    check('marking the same lead twice: one row, same id both times', l1.status === 200 && l2.status === 200 && l1.json.id === l2.json.id && n === 1, `ids ${l1.json?.id}/${l2.json?.id} rows ${n}`);
    await pool.query("insert into leads (user_id, parcel_key, status) values ($1,$2,'new')", [main.id, pk]); // simulate an old duplicate
    const pid = (await pool.query('select parcel_id from parcels_current_all where parcel_key=$1 limit 1', [pk])).rows[0].parcel_id as string;
    r = await call(search.POST, { counties: ['Clay'], parcelId: pid, limit: 50 });
    const mine = (r.json?.list || []).filter((x: any) => x.parcel_key === pk);
    check('even with duplicate lead rows the parcel appears once in results, flagged as a lead', mine.length === 1 && mine[0].is_lead === true, `${mine.length} rows`);

    // ---- 4. notes: validated and capped
    r = await call(notesRoute.POST, {});
    check('note with no parcel or text -> 400', r.status === 400, `${r.status}`);
    r = await call(notesRoute.POST, { parcelKey: pk, note: '   ' });
    check('blank note -> 400', r.status === 400, `${r.status}`);
    r = await call(notesRoute.POST, { parcelKey: pk, note: 'test_flreview_' + 'x'.repeat(5000) });
    check('note over 5,000 characters -> 400', r.status === 400, `${r.status}`);
    r = await call(notesRoute.POST, '{not json', true);
    check('broken JSON -> 400 (not a crash)', r.status === 400, `${r.status}`);
    r = await call(notesRoute.POST, { parcelKey: pk, note: 'test_flreview_ok' });
    check('a normal note still saves', r.status === 200 && r.json?.success === true, `${r.status}`);

    // ---- 5. choosing counties: real county names only, quota holds under simultaneous requests
    // every county the screen can offer must still be accepted (the new "real counties only" rule must not lock anyone out)
    { const { FLORIDA_COUNTIES, LIVE_COUNTIES } = await import('../../lib/counties'); const { countyCode } = await import('../../lib/parcels/key');
      const bad = [...new Set([...FLORIDA_COUNTIES, ...LIVE_COUNTIES])].filter((c) => countyCode(c) === null);
      check('every county name the screen offers is a recognised county', bad.length === 0, `unrecognised: ${JSON.stringify(bad)}`); }
    as(second.clerk_id);
    r = await call(countiesRoute.POST, { county: 'Atlantis' });
    check('unknown county -> 400, nothing saved', r.status === 400 && Number((await pool.query('select count(*) n from user_county_access where user_id=$1', [second.id])).rows[0].n) === 0, `${r.status}`);
    await pool.query('delete from user_county_access where user_id = $1', [second.id]); // start the race test from an empty plan, whatever the previous check did
    const [a, b, c] = await Promise.all([call(countiesRoute.POST, { county: 'Clay' }), call(countiesRoute.POST, { county: 'Duval' }), call(countiesRoute.POST, { county: 'Baker' })]);
    const rows = Number((await pool.query('select count(*) n from user_county_access where user_id=$1', [second.id])).rows[0].n);
    check('three simultaneous picks on a 1-county plan: exactly 1 saved', rows === 1 && [a, b, c].filter((x) => x.status === 200).length === 1, `rows ${rows} statuses ${[a, b, c].map((x) => x.status)}`);
  } finally {
    await cleanup().catch((e) => console.log('cleanup problem:', e.message));
  }

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
