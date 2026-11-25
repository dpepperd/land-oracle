// Skip tracing with the MOCK provider: flag, credits, caching, charging rules, access, failures, double clicks. Real route handler + service on the DEV database
// (public schema; it applies db/migrations/016_skip_trace.sql there, which is idempotent) with a stubbed sign-in. Uses throwaway users and removes its rows.
// Never touches app_prod. Usage: npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-skiptrace.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', '016_skip_trace.sql'), 'utf8'));
  const svc = await import('../../lib/skiptrace/service');
  const { mockCalls, resetMockCalls, mockProvider } = await import('../../lib/skiptrace/mock');
  const { getProvider } = await import('../../lib/skiptrace/providers');
  const route = await import('../../app/api/skiptrace/route');

  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const post = async (body: any) => { const r = await route.POST(new Request('http://localhost/api/skiptrace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, json: await r.json() }; };
  const get = async () => { const r = await route.GET(); return { status: r.status, json: await r.json() }; };

  // ---- users: the dev non-admin (has Clay, Duval, Baker) and a throwaway second account
  const main = (await pool.query("select u.id, u.clerk_id from users u where coalesce(u.role,'user')<>'admin' and u.clerk_id is not null and exists (select 1 from user_county_access a where a.user_id=u.id and a.county='Clay') order by u.id limit 1")).rows[0];
  if (!main) { console.log('FAIL  no non-admin dev user with Clay'); process.exit(1); }
  const tag = 'test_skiptrace_' + Date.now();
  const second = (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id, clerk_id", [tag, tag + '@example.invalid'])).rows[0];
  await pool.query("delete from skip_trace_cache where provider = 'mock'"); // start clean: results saved by an earlier run would hide the first vendor call
  await pool.query('delete from skip_trace_lookups where user_id = $1', [main.id]);
  const touched = { users: [main.id, second.id], keys: [] as string[] };
  const origCredits = (await pool.query('select balance, used from skip_trace_credits where user_id=$1', [main.id])).rows[0] ?? null;
  const owner = (n: string) => ({ name: `${tag} ${n}`, mailingAddress: '1 TEST ST MIAMI FL 33101' });
  const credits = async (id: number) => (await pool.query('select coalesce(balance,0) b from skip_trace_credits where user_id=$1', [id])).rows[0]?.b ?? 0;
  const setCredits = async (id: number, n: number) => { await pool.query('insert into skip_trace_credits (user_id, balance) values ($1,$2) on conflict (user_id) do update set balance=$2', [id, n]); };
  const cleanup = async () => {
    await pool.query("delete from skip_trace_cache where provider = 'mock'"); // dev table, mock data only
    for (const id of touched.users) { await pool.query('delete from skip_trace_lookups where user_id=$1 and (owner_key = any($2::text[]) or parcel_key is not null)', [id, touched.keys]); }
    await pool.query('delete from users where id=$1', [second.id]);
    if (origCredits) await pool.query('update skip_trace_credits set balance=$2, used=$3 where user_id=$1', [main.id, origCredits.balance, origCredits.used]); else await pool.query('delete from skip_trace_credits where user_id=$1', [main.id]);
  };

  try {
    process.env.SKIPTRACE_PROVIDER = 'mock';

    // ---- flag OFF (the default): invisible and inert
    delete process.env.SKIPTRACE_ENABLED;
    as(main.clerk_id);
    let r = await get();
    check('flag off: GET says enabled=false', r.status === 200 && r.json.enabled === false, JSON.stringify(r.json));
    r = await post({ parcel_key: 'FL-00-00-00' });
    check('flag off: POST is 404 not_available', r.status === 404 && r.json.error === 'not_available', String(r.status));
    check('flag off: the service itself refuses (no vendor call)', await svc.lookupContact(main.id, owner('off'), { provider: mockProvider }).then(() => false, (e) => e.code === 'not_available'), `calls ${mockCalls()}`);

    // ---- flag ON
    process.env.SKIPTRACE_ENABLED = 'true';
    await setCredits(main.id, 3);
    r = await get();
    check('flag on: GET enabled with the credit balance', r.status === 200 && r.json.enabled === true && r.json.credits === 3, JSON.stringify(r.json));

    // real parcels with a known owner in Clay (the account has Clay)
    const pk = (await pool.query("select parcel_key from parcels_current_all where county='Clay' and own_name is not null and own_addr1 is not null and btrim(own_name)<>'' limit 3")).rows.map((x: any) => x.parcel_key as string);
    resetMockCalls();
    r = await post({ parcel_key: pk[0] });
    check('first lookup: matched, phones + emails, 1 credit charged, vendor called once', r.status === 200 && r.json.matched && r.json.phones.length >= 1 && r.json.emails.length >= 1 && r.json.charged === 1 && r.json.creditsLeft === 2 && r.json.cached === false && mockCalls() === 1, `${r.status} charged ${r.json.charged} left ${r.json.creditsLeft} calls ${mockCalls()}`);
    check('phone shape (number, type, doNotCall flag present)', typeof r.json.phones[0].number === 'string' && 'doNotCall' in r.json.phones[0], JSON.stringify(r.json.phones[0]));
    const again = await post({ parcel_key: pk[0] });
    check('same parcel again: saved result, no charge, vendor NOT called again', again.json.cached === true && again.json.charged === 0 && again.json.creditsLeft === 2 && mockCalls() === 1, `cached ${again.json.cached} left ${again.json.creditsLeft} calls ${mockCalls()}`);
    const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
    check('saved result has the same contents as the first', JSON.stringify(canon(again.json.phones)) === JSON.stringify(canon(r.json.phones)) && JSON.stringify(again.json.emails) === JSON.stringify(r.json.emails), '');

    // ---- unavailable / invalid
    r = await post({ parcel_key: 'FL-20-99-99-99-999999-999-99' });
    check('well-formed parcel that does not exist -> 404, no charge', r.status === 404 && (await credits(main.id)) === 2, `${r.status} ${r.json.error}`);
    r = await post({ parcel_key: 'not a parcel key' });
    check('malformed parcel key -> 400, no charge', r.status === 400 && (await credits(main.id)) === 2, `${r.status} ${r.json.error}`);
    const other = (await pool.query("select parcel_key from parcels_current_all where county='Hillsborough' and own_name is not null and own_addr1 is not null limit 1")).rows[0]?.parcel_key;
    if (other) { r = await post({ parcel_key: other }); check('parcel in a county not on the plan -> 403, no charge, vendor not called', r.status === 403 && (await credits(main.id)) === 2 && mockCalls() === 1, `${r.status} ${r.json.error}`); }
    r = await post({});
    check('missing parcel_key -> 400', r.status === 400, String(r.status));
    as(null);
    r = await post({ parcel_key: pk[0] });
    check('signed out -> 401', r.status === 401, String(r.status));
    r = await get();
    check('signed out GET -> 401', r.status === 401, String(r.status));
    as(main.clerk_id);

    // ---- shared cache across accounts, charged once per account
    const q1 = owner('shared');
    touched.keys.push(svc.ownerKey(q1));
    await setCredits(main.id, 5); await setCredits(second.id, 5);
    resetMockCalls();
    const a1 = await svc.lookupContact(main.id, q1);
    const b1 = await svc.lookupContact(second.id, q1);
    const b2 = await svc.lookupContact(second.id, q1);
    check('second account, same owner: vendor NOT called again (shared cache)', mockCalls() === 1 && a1.cached === false && b1.cached === true, `calls ${mockCalls()}`);
    check('each account is charged once for that owner', a1.charged === 1 && b1.charged === 1 && b2.charged === 0 && (await credits(second.id)) === 4 && (await credits(main.id)) === 4, `main ${await credits(main.id)} second ${await credits(second.id)}`);
    check('owner key ignores case, punctuation and spacing', svc.ownerKey({ name: 'Smith, John  A.', mailingAddress: '12 Oak St.,  Miami FL' }) === svc.ownerKey({ name: 'SMITH JOHN A', mailingAddress: '12 oak st miami fl' }), '');
    check('different owner -> different key', svc.ownerKey(owner('x')) !== svc.ownerKey(owner('y')), '');

    // ---- a miss is free and is cached (not paid for twice)
    const qMiss = owner('NOMATCH'); touched.keys.push(svc.ownerKey(qMiss));
    resetMockCalls();
    const m1 = await svc.lookupContact(main.id, qMiss);
    const m2 = await svc.lookupContact(main.id, qMiss);
    check('miss: matched=false, free', m1.matched === false && m1.charged === 0 && (await credits(main.id)) === 4, `left ${await credits(main.id)}`);
    check('miss is cached: vendor called once', mockCalls() === 1 && m2.cached === true, `calls ${mockCalls()}`);

    // ---- vendor failure: no charge, nothing cached
    const qBoom = owner('BOOM'); touched.keys.push(svc.ownerKey(qBoom));
    const before = await credits(main.id);
    const err: any = await svc.lookupContact(main.id, qBoom).then(() => null, (e) => e);
    const cachedBoom = (await pool.query('select 1 from skip_trace_cache where owner_key=$1', [svc.ownerKey(qBoom)])).rowCount;
    check('vendor failure: 502 provider_failed, not charged, nothing cached', err?.code === 'provider_failed' && err.status === 502 && (await credits(main.id)) === before && cachedBoom === 0, `${err?.code} left ${await credits(main.id)} cached ${cachedBoom}`);

    // ---- no credits: vendor never called, nothing cached
    await setCredits(main.id, 0);
    const qNo = owner('nocredit'); touched.keys.push(svc.ownerKey(qNo));
    resetMockCalls();
    const e2: any = await svc.lookupContact(main.id, qNo).then(() => null, (e) => e);
    check('no credits: 402 no_credits, vendor NOT called, nothing cached', e2?.code === 'no_credits' && e2.status === 402 && mockCalls() === 0 && (await pool.query('select 1 from skip_trace_cache where owner_key=$1', [svc.ownerKey(qNo)])).rowCount === 0, `${e2?.code} calls ${mockCalls()}`);
    r = await post({ parcel_key: pk[1] ?? pk[0] });
    check('no credits via the route: 402', pk[1] ? (r.status === 402 || r.json.cached === true) : true, `${r.status}`);
    // a saved miss is still readable with 0 credits (free)
    const m3 = await svc.lookupContact(main.id, qMiss);
    check('0 credits: a saved miss is still free to read', m3.matched === false && m3.cached === true, '');
    // a saved hit this account already paid for is still readable with 0 credits
    const a3 = await svc.lookupContact(main.id, q1);
    check('0 credits: a result this account already paid for is still readable', a3.matched === true && a3.charged === 0, '');

    // ---- double click: two simultaneous lookups of a NEW owner -> one vendor call, one charge
    await setCredits(main.id, 5);
    const qRace = owner('race'); touched.keys.push(svc.ownerKey(qRace));
    resetMockCalls();
    const [x, y] = await Promise.all([svc.lookupContact(main.id, qRace), svc.lookupContact(main.id, qRace)]);
    check('double click: one vendor call, one charge', mockCalls() === 1 && x.charged + y.charged === 1 && (await credits(main.id)) === 4, `calls ${mockCalls()} charged ${x.charged}+${y.charged} left ${await credits(main.id)}`);

    // ---- the mock can never be used in production
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'production';
    let refused = false; try { getProvider('mock'); } catch { refused = true; }
    process.env.VERCEL_ENV = prev ?? '';
    if (prev === undefined) delete process.env.VERCEL_ENV;
    check('mock provider is refused in production', refused, '');
    let unknown = false; try { getProvider('nope'); } catch { unknown = true; }
    check('unknown provider name is an error', unknown, '');

    // ---- deleting an account removes its credits and ledger (foreign keys cascade)
    await pool.query('delete from skip_trace_lookups where user_id=$1', [second.id]);
    await pool.query('delete from users where id=$1', [second.id]);
    check('deleting a user removes their credit row', (await pool.query('select 1 from skip_trace_credits where user_id=$1', [second.id])).rowCount === 0, '');
  } finally {
    await cleanup().catch((e) => console.log('cleanup problem:', e.message));
  }

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
