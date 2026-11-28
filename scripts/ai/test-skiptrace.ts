// Skip tracing on the WALLET, with the MOCK provider: flag, prices from settings, holds (reserve / settle / release), caching, the Do Not Call (DNC) add-on
// in its three modes, access, failures, double clicks. Real route handler + service on the DEV database (public schema; it applies migrations 016, 017, 018,
// 020 and 021 there, all idempotent) with a stubbed sign-in. Uses throwaway users (their wallets go with them) and restores the settings rows it changes.
// Never touches app_prod. Usage: npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-skiptrace.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  for (const f of ['016_skip_trace.sql', '017_wallet.sql', '018_postcard_sizes.sql', '020_wallet_holds.sql', '021_skiptrace_wallet.sql']) {
    await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8'));
  }
  const svc = await import('../../lib/skiptrace/service');
  const { mockCalls, mockDncCalls, resetMockCalls, mockProvider } = await import('../../lib/skiptrace/mock');
  const { getProvider } = await import('../../lib/skiptrace/providers');
  const route = await import('../../app/api/skiptrace/route');
  const L = await import('../../lib/wallet/ledger');
  const S = await import('../../lib/wallet/settings');
  const { ProviderError } = await import('../../lib/skiptrace/types');

  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const post = async (body: any) => { const r = await route.POST(new Request('http://localhost/api/skiptrace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, json: await r.json() }; };
  const get = async () => { const r = await route.GET(); return { status: r.status, json: await r.json() }; };

  // ---- settings we change are put back exactly as they were
  const orig = (await pool.query("select key, value from app_settings where key in ('wallet_prices','skiptrace_options')")).rows;
  const restoreSettings = async () => {
    await pool.query("delete from app_settings where key in ('wallet_prices','skiptrace_options')");
    for (const r of orig) await pool.query('insert into app_settings (key, value) values ($1,$2::jsonb)', [r.key, JSON.stringify(r.value)]);
  };
  if (!orig.some((r) => r.key === 'wallet_prices')) { console.log('FAIL  dev database has no wallet_prices row (run the wallet tests first)'); process.exit(1); }
  const basePrices: any = await S.getPrices(pool);
  const setPrices = (contact: { cents: number; enabled: boolean }, dnc: { cents: number; enabled: boolean }) => S.setPrices(pool, { ...basePrices, skip_trace: contact, skip_trace_dnc: dnc }, null);
  const setMode = (m: string) => pool.query(`insert into app_settings (key, value) values ('skiptrace_options', $1::jsonb) on conflict (key) do update set value = excluded.value`, [JSON.stringify({ dnc: m })]);

  // ---- throwaway accounts, each with the Clay plan (county rules are the same code the assistant uses)
  const tag = 'test_skiptrace_' + Date.now();
  const mkUser = async (n: string) => {
    const u = (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role, county_allowance) values ($1,$2,'scout','active','user',1) returning id, clerk_id", [`${tag}_${n}`, `${tag}_${n}@example.invalid`])).rows[0];
    await pool.query("insert into user_county_access (user_id, county) values ($1,'Clay')", [u.id]);
    return u;
  };
  const A = await mkUser('a'), B = await mkUser('b');
  const users = [A.id, B.id];
  await pool.query("delete from skip_trace_cache where provider in ('mock','mockx')"); // start clean: a saved result from an earlier run would hide the first vendor call
  const keys: string[] = [];
  const owner = (n: string) => { const q = { name: `${tag} ${n}`, mailingAddress: '1 TEST ST MIAMI FL 33101' }; keys.push(svc.ownerKey(q)); return q; };
  let fundN = 0;
  /** Sets the account's wallet to exactly this many cents (no holds). */
  const setFunds = async (id: number, cents: number) => {
    await pool.query('delete from wallet_holds where user_id=$1', [id]);
    await pool.query('insert into wallet_accounts (user_id) values ($1) on conflict do nothing', [id]);
    await pool.query('update wallet_accounts set balance_cents=0, held_cents=0 where user_id=$1', [id]);
    if (cents > 0) await L.inTx(pool, (c) => L.credit(c, { userId: id, cents, kind: 'topup', idempotencyKey: `${tag}:fund${++fundN}` }));
  };
  const bal = (id: number) => L.getBalance(pool, id);
  const held = (id: number) => L.getHeld(pool, id);
  const charges = async (id: number) => (await pool.query("select item, amount_cents from wallet_ledger where user_id=$1 and kind='charge' order by id", [id])).rows.map((r: any) => `${r.item}:${r.amount_cents}`);
  const chargesFor = async (id: number, q: any) => (await pool.query("select item, amount_cents from wallet_ledger where user_id=$1 and kind='charge' and ref=$2 order by id", [id, 'owner ' + svc.ownerKey(q).slice(0, 8)])).rows.map((r: any) => `${r.item}:${r.amount_cents}`);
  const cacheRow = async (q: any) => (await pool.query('select * from skip_trace_cache where owner_key=$1', [svc.ownerKey(q)])).rows[0];
  const cleanup = async () => {
    await pool.query("delete from skip_trace_cache where provider in ('mock','mockx')");
    await pool.query('delete from skip_trace_lookups where user_id = any($1::int[])', [users]);
    await pool.query('delete from users where id = any($1::int[])', [users]); // wallet rows, holds, ledger and county access cascade
    await restoreSettings();
  };

  try {
    process.env.SKIPTRACE_PROVIDER = 'mock';
    await setPrices({ cents: 15, enabled: true }, { cents: 5, enabled: true });
    await pool.query("delete from app_settings where key='skiptrace_options'");

    // ================= flag OFF (the default): invisible and inert
    delete process.env.SKIPTRACE_ENABLED;
    as(A.clerk_id);
    let r = await get();
    check('flag off: GET says enabled=false', r.status === 200 && r.json.enabled === false, JSON.stringify(r.json));
    r = await post({ parcel_key: 'FL-00-00-00' });
    check('flag off: POST is 404 not_available', r.status === 404 && r.json.error === 'not_available', String(r.status));
    check('flag off: the service itself refuses (no vendor call, no hold)', await svc.lookupContact(A.id, owner('off'), { provider: mockProvider }).then(() => false, (e) => e.code === 'not_available') && (await held(A.id)) === 0, `calls ${mockCalls()}`);

    // ================= flag ON, DNC off (the default mode)
    process.env.SKIPTRACE_ENABLED = 'true';
    await setFunds(A.id, 500); await setFunds(B.id, 500);
    r = await get();
    check('flag on: GET shows the price from settings ($0.15), the spendable balance, and no DNC option', r.status === 200 && r.json.enabled === true && r.json.contactCents === 15 && r.json.balanceCents === 500 && r.json.dnc === null && r.json.totalCents === 15, JSON.stringify(r.json));
    await setPrices({ cents: 15, enabled: false }, { cents: 5, enabled: true });
    r = await get();
    check('contact item switched off in settings: GET says enabled=false (the button disappears)', r.json.enabled === false, JSON.stringify(r.json));
    await setPrices({ cents: 0, enabled: true }, { cents: 5, enabled: true });
    check('contact item enabled at $0: not offered (nothing is free by accident)', (await get()).json.enabled === false, '');
    await setPrices({ cents: 15, enabled: true }, { cents: 5, enabled: true });

    const pk = (await pool.query("select parcel_key from parcels_current_all where county='Clay' and own_name is not null and own_addr1 is not null and btrim(own_name)<>'' limit 3")).rows.map((x: any) => x.parcel_key as string);
    resetMockCalls();
    r = await post({ parcel_key: pk[0] });
    check('first lookup: matched, phones + emails, $0.15 charged to the wallet, vendor called once', r.status === 200 && r.json.matched && r.json.phones.length >= 1 && r.json.emails.length >= 1 && r.json.chargedCents === 15 && r.json.chargedContactCents === 15 && r.json.chargedDncCents === 0 && r.json.balanceCents === 485 && r.json.cached === false && mockCalls() === 1, JSON.stringify({ s: r.status, c: r.json.chargedCents, b: r.json.balanceCents, calls: mockCalls() }));
    check('the charge is one ledger row for item skip_trace, and nothing is left held', (await charges(A.id)).join() === 'skip_trace:-15' && (await held(A.id)) === 0 && (await bal(A.id)) === 485, (await charges(A.id)).join());
    check('DNC off: phones carry NO do-not-call flag and the answer says DNC is not included', r.json.phones.every((p: any) => !('doNotCall' in p)) && r.json.dncIncluded === false && r.json.dncCheckedAt === null, JSON.stringify(r.json.phones[0]));
    const again = await post({ parcel_key: pk[0] });
    check('same parcel again: saved result, no charge, vendor NOT called again', again.json.cached === true && again.json.chargedCents === 0 && again.json.balanceCents === 485 && mockCalls() === 1, `cached ${again.json.cached} bal ${again.json.balanceCents} calls ${mockCalls()}`);
    const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
    check('saved result has the same contents as the first', JSON.stringify(canon(again.json.phones)) === JSON.stringify(canon(r.json.phones)) && JSON.stringify(again.json.emails) === JSON.stringify(r.json.emails), '');

    // ---- unavailable / invalid: nothing charged, nothing held
    r = await post({ parcel_key: 'FL-20-99-99-99-999999-999-99' });
    check('well-formed parcel that does not exist -> 404, no charge', r.status === 404 && (await bal(A.id)) === 485 && (await held(A.id)) === 0, `${r.status} ${r.json.error}`);
    r = await post({ parcel_key: 'not a parcel key' });
    check('malformed parcel key -> 400, no charge', r.status === 400 && (await bal(A.id)) === 485, `${r.status} ${r.json.error}`);
    const other = (await pool.query("select parcel_key from parcels_current_all where county='Hillsborough' and own_name is not null and own_addr1 is not null limit 1")).rows[0]?.parcel_key;
    if (other) { r = await post({ parcel_key: other }); check('parcel in a county not on the plan -> 403, no charge, vendor not called', r.status === 403 && (await bal(A.id)) === 485 && mockCalls() === 1, `${r.status} ${r.json.error}`); }
    r = await post({});
    check('missing parcel_key -> 400', r.status === 400, String(r.status));
    as(null);
    r = await post({ parcel_key: pk[0] });
    check('signed out -> 401', r.status === 401, String(r.status));
    r = await get();
    check('signed out GET -> 401', r.status === 401, String(r.status));
    as(A.clerk_id);

    // ---- shared cache across accounts, each account pays once for an owner
    const q1 = owner('shared');
    resetMockCalls();
    const a1 = await svc.lookupContact(A.id, q1);
    const b1 = await svc.lookupContact(B.id, q1);
    const b2 = await svc.lookupContact(B.id, q1);
    check('second account, same owner: vendor NOT called again (shared cache)', mockCalls() === 1 && a1.cached === false && b1.cached === true, `calls ${mockCalls()}`);
    check('each account is charged once for that owner ($0.15 each), repeats are free', a1.chargedCents === 15 && b1.chargedCents === 15 && b2.chargedCents === 0 && (await bal(B.id)) === 485 && (await bal(A.id)) === 470, `A ${await bal(A.id)} B ${await bal(B.id)}`);
    check('owner key ignores case, punctuation and spacing', svc.ownerKey({ name: 'Smith, John  A.', mailingAddress: '12 Oak St.,  Miami FL' }) === svc.ownerKey({ name: 'SMITH JOHN A', mailingAddress: '12 oak st miami fl' }), '');
    check('different owner -> different key', svc.ownerKey(owner('x')) !== svc.ownerKey(owner('y')), '');

    // ---- a miss is free, releases its hold, and is cached (not paid for twice)
    const qMiss = owner('NOMATCH');
    resetMockCalls();
    const m1 = await svc.lookupContact(A.id, qMiss);
    const m2 = await svc.lookupContact(A.id, qMiss);
    check('miss: matched=false, free, the hold is released (nothing held, balance unchanged)', m1.matched === false && m1.chargedCents === 0 && (await bal(A.id)) === 470 && (await held(A.id)) === 0, `bal ${await bal(A.id)} held ${await held(A.id)}`);
    check('miss is cached: vendor called once', mockCalls() === 1 && m2.cached === true, `calls ${mockCalls()}`);

    // ---- vendor failure: not charged, hold released, nothing cached
    const qBoom = owner('BOOM');
    const before = await bal(A.id);
    const err: any = await svc.lookupContact(A.id, qBoom).then(() => null, (e) => e);
    check('vendor failure: 502 provider_failed, not charged, hold released, nothing cached', err?.code === 'provider_failed' && err.status === 502 && (await bal(A.id)) === before && (await held(A.id)) === 0 && !(await cacheRow(qBoom)), `${err?.code} bal ${await bal(A.id)} held ${await held(A.id)}`);

    // ---- no funds: vendor never called, nothing cached, nothing held
    await setFunds(A.id, 0);
    const qNo = owner('nofunds');
    resetMockCalls();
    const e2: any = await svc.lookupContact(A.id, qNo).then(() => null, (e) => e);
    check('no funds: 402 insufficient_funds (with the price), vendor NOT called, nothing cached, nothing held', e2?.code === 'insufficient_funds' && e2.status === 402 && /\$0\.15/.test(e2.message) && mockCalls() === 0 && !(await cacheRow(qNo)) && (await held(A.id)) === 0, `${e2?.code} ${e2?.message}`);
    await setFunds(A.id, 14);
    const e3: any = await svc.lookupContact(A.id, qNo).then(() => null, (e) => e);
    check('$0.14 is not enough for a $0.15 lookup', e3?.code === 'insufficient_funds' && mockCalls() === 0 && (await bal(A.id)) === 14, `${e3?.code}`);
    r = await post({ parcel_key: pk[1] ?? pk[0] });
    check('no funds via the route: 402 insufficient_funds (or a result already paid for)', r.status === 402 ? r.json.error === 'insufficient_funds' : r.json.cached === true, `${r.status}`);
    const m3 = await svc.lookupContact(A.id, qMiss);
    check('no funds: a saved miss is still free to read', m3.matched === false && m3.cached === true && m3.chargedCents === 0, '');
    const a3 = await svc.lookupContact(A.id, q1);
    check('no funds: a result this account already paid for is still readable', a3.matched === true && a3.chargedCents === 0, '');

    // ---- double click: two simultaneous lookups of a NEW owner -> one vendor call, one charge
    await setFunds(A.id, 500);
    const qRace = owner('race');
    resetMockCalls();
    const [x, y] = await Promise.all([svc.lookupContact(A.id, qRace), svc.lookupContact(A.id, qRace)]);
    check('double click: one vendor call, one $0.15 charge, nothing left held', mockCalls() === 1 && x.chargedCents + y.chargedCents === 15 && (await bal(A.id)) === 485 && (await held(A.id)) === 0, `calls ${mockCalls()} charged ${x.chargedCents}+${y.chargedCents} bal ${await bal(A.id)}`);
    // two different owners at once on money for exactly one
    await setFunds(A.id, 20);
    const settled2 = await Promise.all([svc.lookupContact(A.id, owner('p1')).then(() => 'ok', (e) => e.code), svc.lookupContact(A.id, owner('p2')).then(() => 'ok', (e) => e.code)]);
    check('two lookups at once on $0.20: one goes through, one is refused for funds, balance never negative', settled2.filter((s) => s === 'ok').length === 1 && settled2.includes('insufficient_funds' as any) && (await bal(A.id)) === 5 && (await held(A.id)) === 0, JSON.stringify(settled2));

    // ================= DNC: optional
    await setFunds(A.id, 1000); await setFunds(B.id, 1000);
    await setMode('optional');
    r = await get();
    check('DNC optional: GET offers the add-on ($0.05) and the contact price alone is the total', r.json.enabled && r.json.dnc?.mode === 'optional' && r.json.dnc.cents === 5 && r.json.totalCents === 15, JSON.stringify(r.json));
    const qD1 = owner('dnc1');
    resetMockCalls();
    let d1 = await svc.lookupContact(A.id, qD1);
    check('DNC optional, not ticked: contact only ($0.15), no flags, no DNC vendor request', d1.chargedCents === 15 && d1.chargedDncCents === 0 && d1.dncIncluded === false && d1.phones.every((p) => !('doNotCall' in p)) && mockDncCalls() === 0, JSON.stringify({ c: d1.chargedCents, d: mockDncCalls() }));
    d1 = await svc.lookupContact(A.id, qD1, { dnc: true });
    const stored1 = await cacheRow(qD1);
    check('adding the check later: only the add-on is charged ($0.05), flags appear, the vendor is asked again WITH the check', d1.chargedContactCents === 0 && d1.chargedDncCents === 5 && d1.dncIncluded && d1.phones.every((p) => typeof p.doNotCall === 'boolean') && mockCalls() === 2 && mockDncCalls() === 1 && stored1.dnc_checked_at !== null, JSON.stringify({ c: d1.chargedContactCents, d: d1.chargedDncCents, calls: mockCalls() }));
    check('the check date is returned and is today', !!d1.dncCheckedAt && Date.now() - new Date(d1.dncCheckedAt!).getTime() < 60_000, String(d1.dncCheckedAt));
    d1 = await svc.lookupContact(A.id, qD1, { dnc: true });
    check('asking again: free, from the saved result, flags still shown, vendor not called', d1.chargedCents === 0 && d1.cached && d1.dncIncluded && mockCalls() === 2, '');
    check('ledger shows each item separately: skip_trace -15 then skip_trace_dnc -5', (await chargesFor(A.id, qD1)).join() === 'skip_trace:-15,skip_trace_dnc:-5', (await chargesFor(A.id, qD1)).join());

    const qD2 = owner('dnc2');
    resetMockCalls();
    const d2 = await svc.lookupContact(B.id, qD2, { dnc: true });
    check('new owner with the check ticked: $0.20 total ($0.15 + $0.05) in ONE vendor call that asks for DNC', d2.chargedCents === 20 && d2.chargedContactCents === 15 && d2.chargedDncCents === 5 && mockCalls() === 1 && mockDncCalls() === 1 && (await held(B.id)) === 0 && (await bal(B.id)) === 980, JSON.stringify({ c: d2.chargedCents, calls: mockCalls(), bal: await bal(B.id) }));
    const d2a = await svc.lookupContact(A.id, qD2, { dnc: true });
    check('another account buys the same owner with the check: no vendor call (the check is fresh), charged $0.20, sees the flags', d2a.chargedCents === 20 && d2a.cached && d2a.dncIncluded && d2a.phones.every((p) => typeof p.doNotCall === 'boolean') && mockCalls() === 1, JSON.stringify({ c: d2a.chargedCents, calls: mockCalls() }));
    const d2b = await svc.lookupContact(B.id, owner('dnc2'), { dnc: false });
    check('a saved result never gives the DNC flags away: an account that did not buy the check gets none', d2b.dncIncluded === false && d2b.phones.every((p) => !('doNotCall' in p)) && d2b.dncCheckedAt === null, '');
    // ticked but not enough money for contact + add-on
    await setFunds(A.id, 15);
    resetMockCalls();
    const e4: any = await svc.lookupContact(A.id, owner('dncpoor'), { dnc: true }).then(() => null, (e) => e);
    check('$0.15 is not enough for contact + check ($0.20): refused, vendor not called, no hold left behind', e4?.code === 'insufficient_funds' && mockCalls() === 0 && (await held(A.id)) === 0 && (await bal(A.id)) === 15, `${e4?.code}`);
    // staleness: the check goes stale after 30 days and is re-checked (and re-charged to an account whose purchase is also old)
    await setFunds(A.id, 1000);
    const qD3 = owner('dnc3');
    await svc.lookupContact(A.id, qD3, { dnc: true });
    await pool.query("update skip_trace_cache set dnc_checked_at = now() - interval '40 days' where owner_key=$1", [svc.ownerKey(qD3)]);
    resetMockCalls();
    let st = await svc.lookupContact(A.id, qD3, { dnc: true });
    check('stale check, same account bought it recently: the vendor re-checks it, no second charge', mockDncCalls() === 1 && st.chargedCents === 0 && st.dncIncluded && Date.now() - new Date(st.dncCheckedAt!).getTime() < 60_000, JSON.stringify({ calls: mockDncCalls(), c: st.chargedCents }));
    await pool.query("update skip_trace_cache set dnc_checked_at = now() - interval '40 days' where owner_key=$1", [svc.ownerKey(qD3)]);
    await pool.query("update skip_trace_lookups set created_at = now() - interval '40 days' where user_id=$1 and owner_key=$2", [A.id, svc.ownerKey(qD3)]);
    resetMockCalls();
    st = await svc.lookupContact(A.id, qD3, { dnc: true });
    check('stale check AND the purchase is over 30 days old: re-checked and charged the add-on again ($0.05)', mockDncCalls() === 1 && st.chargedDncCents === 5 && st.chargedContactCents === 0, JSON.stringify({ d: st.chargedDncCents }));

    // ---- a vendor that does not answer the DNC question for every phone: no charge for the check, no flags claimed
    const quiet: any = { id: 'mockx', capabilities: { dnc: true }, async lookup(qq: any) { return { matched: true, provider: 'mockx', phones: [{ number: '(305) 555-0100', type: 'mobile' }], emails: [] }; } };
    const qQ = owner('unanswered');
    const uq = await svc.lookupContact(A.id, qQ, { dnc: true, provider: quiet });
    check('vendor skipped the DNC answers: contact charged, the check NOT charged, DNC not claimed (unknown is not safe)', uq.chargedContactCents === 15 && uq.chargedDncCents === 0 && uq.dncIncluded === false && uq.phones.every((p) => !('doNotCall' in p)), JSON.stringify({ c: uq.chargedContactCents, d: uq.chargedDncCents }));

    // ================= DNC: required
    await setFunds(A.id, 1000);
    await setMode('required');
    r = await get();
    check('DNC required: GET shows the total ($0.20) and the add-on as required', r.json.enabled && r.json.dnc?.mode === 'required' && r.json.totalCents === 20, JSON.stringify(r.json));
    const qR = owner('required');
    resetMockCalls();
    const rq = await svc.lookupContact(A.id, qR, { dnc: false }); // even if the caller says no
    check('DNC required: every lookup includes the check ($0.20) even when the caller did not ask', rq.chargedCents === 20 && rq.dncIncluded && rq.phones.every((p) => typeof p.doNotCall === 'boolean') && mockDncCalls() === 1, JSON.stringify({ c: rq.chargedCents }));
    await setPrices({ cents: 15, enabled: true }, { cents: 5, enabled: false });
    resetMockCalls();
    const rOff: any = await svc.lookupContact(A.id, owner('requiredoff')).then(() => null, (e) => e);
    check('DNC required but the add-on is switched off: lookups stop (contact data is never sold without the check), vendor not called', rOff?.code === 'not_available' && mockCalls() === 0 && (await held(A.id)) === 0, `${rOff?.code}`);
    check('...and GET says the button is off', (await get()).json.enabled === false, '');
    await setPrices({ cents: 15, enabled: true }, { cents: 5, enabled: true });
    const noDncVendor: any = { id: 'mockx', capabilities: { dnc: false }, lookup: async () => { throw new Error('should not be called'); } };
    const rNoCap: any = await svc.lookupContact(A.id, owner('nocap'), { provider: noDncVendor }).then(() => null, (e) => e);
    check('DNC required but this vendor cannot do it: refused before any call', rNoCap?.code === 'not_available', `${rNoCap?.code}`);
    await setMode('optional');
    const rNoCap2: any = await svc.lookupContact(A.id, owner('nocap2'), { provider: noDncVendor, dnc: true }).then(() => null, (e) => e);
    check('DNC optional, ticked, vendor cannot do it: refused before any call', rNoCap2?.code === 'not_available', `${rNoCap2?.code}`);

    // ================= settings fail closed
    await setMode('required');
    await pool.query("update app_settings set value = '{\"dnc\":\"banana\"}'::jsonb where key='skiptrace_options'");
    r = await post({ parcel_key: pk[2] ?? pk[0] });
    check('a damaged DNC setting stops lookups (fails closed), nothing charged', r.status === 503 && r.json.error === 'not_available' && (await held(A.id)) === 0, `${r.status}`);
    check('...and GET says the button is off', (await get()).json.enabled === false, '');
    await pool.query("delete from app_settings where key='skiptrace_options'");
    const rawPrices = (await pool.query("select value from app_settings where key='wallet_prices'")).rows[0].value;
    const { skip_trace_dnc: _drop, ...withoutDnc } = rawPrices;
    check('a saved prices row from before the DNC item existed still works: the item counts as switched off', S.validatePrices(withoutDnc).skip_trace_dnc.enabled === false && S.validatePrices(withoutDnc).skip_trace_dnc.cents === 0, '');
    check('DNC options: only off, optional or required are accepted', ['off', 'optional', 'required'].every((m) => S.validateSkipTraceOptions({ dnc: m }).dnc === m) && ['', 'yes', null, undefined].every((m) => { try { S.validateSkipTraceOptions({ dnc: m }); return false; } catch { return true; } }), '');

    // ---- the mock can never be used in production
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = 'production';
    let refused = false; try { getProvider('mock'); } catch { refused = true; }
    process.env.VERCEL_ENV = prev ?? '';
    if (prev === undefined) delete process.env.VERCEL_ENV;
    check('mock provider is refused in production', refused, '');
    let unknown = false; try { getProvider('nope'); } catch { unknown = true; }
    check('unknown provider name is an error', unknown, '');
    void ProviderError;

    // ---- deleting an account removes its wallet, holds and lookup history
    await pool.query('delete from skip_trace_lookups where user_id=$1', [B.id]);
    await pool.query('delete from users where id=$1', [B.id]);
    check('deleting a user removes their wallet and holds (foreign keys cascade)', (await pool.query('select 1 from wallet_accounts where user_id=$1', [B.id])).rowCount === 0 && (await pool.query('select 1 from wallet_holds where user_id=$1', [B.id])).rowCount === 0, '');
  } finally {
    await cleanup().catch((e) => console.log('cleanup problem:', e.message));
  }

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
