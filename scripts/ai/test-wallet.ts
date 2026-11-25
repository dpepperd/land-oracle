// Credit wallet + postcards: ledger rules, admin-set prices, Stripe top-ups (test mode), Lob address check and charge order.
// Real code on the DEV database (public schema; it applies db/migrations/017_wallet.sql there, which is idempotent) with a FAKE Lob and a FAKE Stripe event:
// no network, no real money, no real mail. Uses throwaway users and removes its rows. Never touches app_prod.
// Usage: npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-wallet.ts
import fs from 'fs';
import path from 'path';
import Module from 'module';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

// next/headers only works inside a Next request; the webhook route reads the signature header from it, so give it a stand-in.
let sigHeader = '';
const origLoad = (Module as any)._load;
(Module as any)._load = function (req: string, ...rest: any[]) {
  if (req === 'next/headers') return { headers: async () => new Headers({ 'stripe-signature': sigHeader }) };
  return origLoad.call(this, req, ...rest);
};

(async () => {
  const { default: pool } = await import('../../lib/db');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', '017_wallet.sql'), 'utf8'));
  const m018 = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', '018_postcard_sizes.sql'), 'utf8');
  await pool.query(m018);
  const L = await import('../../lib/wallet/ledger');
  const S = await import('../../lib/wallet/settings');
  const M = await import('../../lib/wallet/money');
  const T = await import('../../lib/wallet/topup');
  const P = await import('../../lib/wallet/postcards');
  const Lob = await import('../../lib/wallet/lob');
  const A = await import('../../lib/wallet/access');
  const routes = {
    wallet: await import('../../app/api/wallet/route'),
    topup: await import('../../app/api/wallet/topup/route'),
    postcards: await import('../../app/api/postcards/route'),
    preview: await import('../../app/api/postcards/preview/route'),
    assets: await import('../../app/api/postcards/assets/route'),
    webhook: await import('../../app/api/webhooks/stripe/route'),
  };
  const { stripe } = await import('../../lib/stripe');

  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const tag = 'test_wallet_' + Date.now();
  const mk = async (n: string) => (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id, clerk_id", [`${tag}_${n}`, `${tag}_${n}@example.invalid`])).rows[0];
  const u1 = await mk('a'), u2 = await mk('b'), u3 = await mk('c');
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  const origSettings = (await pool.query("select key, value from app_settings where key in ('wallet_prices','postcard_return_address')")).rows;
  const restoreSettings = async () => {
    await pool.query("delete from app_settings where key in ('wallet_prices','postcard_return_address')");
    for (const r of origSettings) await pool.query('insert into app_settings (key, value) values ($1,$2::jsonb)', [r.key, JSON.stringify(r.value)]);
  };
  const origEnv = { ...process.env };
  const balance = (id: number) => L.getBalance(pool, id);
  const ledgerRows = async (id: number) => (await pool.query('select * from wallet_ledger where user_id=$1 order by id', [id])).rows;
  const fund = (id: number, cents: number, key: string) => L.inTx(pool, (c) => L.credit(c, { userId: id, cents, kind: 'topup', idempotencyKey: `${tag}:${key}` }));
  const origFetch = globalThis.fetch;

  try {
    // ================= migration seeds the prices from the spec =================
    await pool.query("delete from app_settings where key in ('wallet_prices','postcard_return_address')");
    await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', '017_wallet.sql'), 'utf8'));
    const seeded = await S.getPrices(pool);
    const on = (k: string, c: number) => (seeded as any)[k].cents === c && (seeded as any)[k].enabled === true;
    const off = (k: string, c: number) => (seeded as any)[k].cents === c && (seeded as any)[k].enabled === false;
    check('seeded prices: postcards 4x6 $1.15, 6x9 $1.30, 6x11 $1.55, all switched on', on('postcard_4x6', 115) && on('postcard_6x9', 130) && on('postcard_6x11', 155), JSON.stringify(seeded));
    check('seeded placeholders, switched OFF: skip trace $0.15, property data $0.20, permit $0.20, monitor alert $0.75', off('skip_trace', 15) && off('property_data', 20) && off('permit', 20) && off('monitor_alert', 75), '');
    check('no price is written in the code (only the migration seeds them)', !/\b115\b|1\.15/.test(['postcards.ts', 'charge.ts', 'ledger.ts', 'settings.ts'].map((p) => fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'wallet', p), 'utf8')).join('\n')), '');

    // ---- migration 018 upgrades an old-shape row (keeps an admin's custom 4x6 price), and is harmless to run twice
    await pool.query("update app_settings set value = '{\"skip_trace\":15,\"postcard\":99,\"property_data\":20,\"permit\":20,\"monitor_alert\":75}'::jsonb where key='wallet_prices'");
    await pool.query(m018);
    const up18: any = await S.getPrices(pool);
    check('migration 018: an old-shape prices row is upgraded; the custom 4x6 price is kept, 6x9/6x11 get 1.30/1.55, placeholders stay off', up18.postcard_4x6.cents === 99 && up18.postcard_4x6.enabled && up18.postcard_6x9.cents === 130 && up18.postcard_6x11.cents === 155 && !up18.skip_trace.enabled && !up18.permit.enabled, JSON.stringify(up18.postcard_4x6));
    await pool.query(m018);
    check('migration 018 run again changes nothing', JSON.stringify(await S.getPrices(pool)) === JSON.stringify(up18), '');
    await S.setPrices(pool, seeded, null);

    // ================= money helpers =================
    check('parseUsdToCents: 20 / $20.5 / 0.15', M.parseUsdToCents('20') === 2000 && M.parseUsdToCents('$20.5') === 2050 && M.parseUsdToCents('0.15') === 15, '');
    check('parseUsdToCents rejects negatives, 3 decimals, text, empty', ['-1', '1.234', 'abc', '', '1e3'].every((x) => M.parseUsdToCents(x) === null), '');

    // ================= ledger =================
    check('new account balance is 0', (await balance(u1.id)) === 0, '');
    const c1 = await fund(u1.id, 2500, 'f1');
    check('top-up credits the balance and writes a ledger row', c1.ok && (await balance(u1.id)) === 2500 && (await ledgerRows(u1.id)).length === 1, '');
    const d1 = await L.inTx(pool, (c) => L.debit(c, { userId: u1.id, cents: 115, kind: 'charge', item: 'postcard', idempotencyKey: `${tag}:d1` }));
    const rows1 = await ledgerRows(u1.id);
    check('charge lowers the balance; ledger keeps signed amount and balance_after', d1.ok && (await balance(u1.id)) === 2385 && Number(rows1[1].amount_cents) === -115 && Number(rows1[1].balance_after_cents) === 2385, '');
    const dup = await fund(u1.id, 2500, 'f1');
    check('the same idempotency key credits only once', dup.ok && dup.duplicate && (await balance(u1.id)) === 2385, '');
    const over = await L.inTx(pool, (c) => L.debit(c, { userId: u1.id, cents: 999999, kind: 'charge', item: 'postcard', idempotencyKey: `${tag}:over` }));
    check('cannot spend more than the balance (refused, balance unchanged, nothing recorded)', !over.ok && (await balance(u1.id)) === 2385 && (await ledgerRows(u1.id)).length === 2, '');
    let dbRefused = false;
    try { await pool.query('update wallet_accounts set balance_cents = -1 where user_id = $1', [u1.id]); } catch { dbRefused = true; }
    check('the database itself refuses a negative balance', dbRefused && (await balance(u1.id)) === 2385, '');
    check('fractional / zero / negative amounts are refused', await Promise.all([0.5, 0, -5].map((n) => L.inTx(pool, (c) => L.credit(c, { userId: u1.id, cents: n as number, kind: 'adjustment', idempotencyKey: `${tag}:bad${n}` })).then(() => false, () => true))).then((a) => a.every(Boolean)), '');

    await fund(u2.id, 1000, 'u2');
    const race = await Promise.all([1, 2, 3, 4, 5].map((i) => L.inTx(pool, (c) => L.debit(c, { userId: u2.id, cents: 300, kind: 'charge', item: 'x', idempotencyKey: `${tag}:race${i}` }))));
    const okCount = race.filter((r) => r.ok).length;
    check('5 simultaneous $3 spends on $10: exactly 3 succeed, $1 left, never negative', okCount === 3 && (await balance(u2.id)) === 100 && (await ledgerRows(u2.id)).filter((r) => r.kind === 'charge').length === 3, `ok=${okCount}`);

    // ================= settings =================
    const bads: any[] = [{ ...seeded, postcard_4x6: { cents: -1, enabled: true } }, { ...seeded, postcard_4x6: { cents: 1.5, enabled: true } }, { ...seeded, postcard_4x6: 115 }, { ...seeded, permit: { cents: 20 } }, { skip_trace: { cents: 1, enabled: false } }, { ...seeded, permit: { cents: 'x', enabled: true } }];
    check('invalid prices are refused (negative, fraction, old number shape, missing switch, missing key, text)', bads.every((v) => { try { S.validatePrices(v); return false; } catch { return true; } }), '');
    await pool.query("delete from app_settings where key='wallet_prices'");
    check('missing price row fails closed (getPrices throws)', await S.getPrices(pool).then(() => false, (e) => e instanceof S.SettingsError), '');
    await S.setPrices(pool, { ...seeded, postcard_4x6: { cents: 200, enabled: true } }, null);
    check('admin price change is read back from the database', (await S.getPrices(pool)).postcard_4x6.cents === 200, '');
    await S.setPrices(pool, seeded, null);

    // ================= top-up rules =================
    check('top-up minimum is $20 (1999 refused, 2000 accepted)', T.topupAmountError(1999) !== null && T.topupAmountError(2000) === null, '');
    check('top-up refuses fractions and huge amounts', T.topupAmountError(2000.5) !== null && T.topupAmountError(10_000_000) !== null, '');
    const sp: any = T.topupSessionParams({ amountCents: 5000, clerkId: 'user_x', origin: 'https://example.test', email: 'a@example.invalid' });
    check('Checkout is a one-time payment for the chosen amount, in USD', sp.mode === 'payment' && sp.line_items[0].price_data.unit_amount === 5000 && sp.line_items[0].price_data.currency === 'usd', '');
    check('billing shows Fortune Oracle Media LLC (receipt text, description, product)', JSON.stringify(sp).split('Fortune Oracle Media LLC').length >= 4 && sp.custom_text.submit.message.includes('Fortune Oracle Media LLC'), '');
    check('stripe key guard: test key ok, live key blocked unless WALLET_ALLOW_LIVE', A.stripeAllowedForWallet('sk_test_abc') && !A.stripeAllowedForWallet('sk_live_abc') && !A.stripeAllowedForWallet(''), '');

    const session = (over: any = {}) => ({ id: 'cs_test_' + Math.random().toString(36).slice(2), mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 5000, client_reference_id: u3.clerk_id, metadata: { kind: 'wallet_topup', userId: u3.clerk_id, amountCents: '5000' }, ...over });
    const credit = (s: any, live = false) => L.inTx(pool, (c) => T.creditTopupFromSession(c, s, live));
    const s1 = session();
    const r1 = await credit(s1);
    check('paid top-up session credits the wallet', r1.credited && (await balance(u3.id)) === 5000, JSON.stringify(r1));
    const r1b = await credit(s1);
    check('the same session replayed credits nothing more', !r1b.credited && (await balance(u3.id)) === 5000, JSON.stringify(r1b));
    check('unpaid session credits nothing', !(await credit(session({ payment_status: 'unpaid' }))).credited, '');
    check('amount that does not match what we asked for credits nothing', !(await credit(session({ amount_total: 9000 }))).credited && !(await credit(session({ amount_total: 1500, metadata: { kind: 'wallet_topup', userId: u3.clerk_id, amountCents: '1500' } }))).credited, '');
    check('non-USD session credits nothing', !(await credit(session({ currency: 'eur' }))).credited, '');
    check('live-mode payment is not credited while test-only', !(await credit(session(), true)).credited, '');
    check('unknown account credits nothing', !(await credit(session({ client_reference_id: 'nobody', metadata: { kind: 'wallet_topup', userId: 'nobody', amountCents: '5000' } }))).credited, '');
    check('subscription sessions are not treated as wallet top-ups', !T.isWalletTopup({ mode: 'subscription', metadata: { kind: 'wallet_topup' } } as any) && T.isWalletTopup(s1 as any), '');
    check('balance is still exactly the one top-up', (await balance(u3.id)) === 5000 && (await ledgerRows(u3.id)).length === 1, '');

    // ---- the real webhook route, with a validly signed fake Stripe event
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_' + tag;
    const hook = async (event: any) => {
      const body = JSON.stringify(event);
      sigHeader = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
      const r = await routes.webhook.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }));
      return r.status;
    };
    const ev = (s: any, id: string, livemode = false) => ({ id, object: 'event', type: 'checkout.session.completed', livemode, data: { object: s } });
    const ws = session({ amount_total: 2000, metadata: { kind: 'wallet_topup', userId: u3.clerk_id, amountCents: '2000' } });
    const evId = 'evt_test_' + tag;
    const st1 = await hook(ev(ws, evId));
    check('webhook: signed top-up event is accepted and credits $20', st1 === 200 && (await balance(u3.id)) === 7000, `status ${st1}`);
    const st2 = await hook(ev(ws, evId));
    check('webhook: the same event delivered twice credits once', st2 === 200 && (await balance(u3.id)) === 7000, `status ${st2}`);
    const st3 = await hook(ev(ws, evId + '_b'));
    check('webhook: a second event for the same payment session still credits once', st3 === 200 && (await balance(u3.id)) === 7000, `status ${st3}`);
    sigHeader = 'bad';
    const stBad = (await routes.webhook.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' }))).status;
    check('webhook: bad signature is refused', stBad === 400, `status ${stBad}`);
    await pool.query('delete from stripe_events where id like $1', ['evt_test_' + tag + '%']);

    // ================= routes: access =================
    delete process.env.WALLET_ENABLED;
    const getJson = async () => { const r = await routes.wallet.GET(); return { status: r.status, json: await r.json() }; };
    as(null);
    check('wallet API: signed out is 401', (await getJson()).status === 401, '');
    as(u1.clerk_id);
    check('wallet API: a normal user is NOT enabled while WALLET_ENABLED is off', (await getJson()).json.enabled === false, '');
    process.env.WALLET_ENABLED = 'true';
    const open = await getJson();
    check('wallet API: a normal user gets the wallet once WALLET_ENABLED=true', open.json.enabled === true && open.json.balanceCents === 2385 && open.json.minTopupCents === 2000 && open.json.billingEntity === 'Fortune Oracle Media LLC' && open.json.prices.postcard_4x6.cents === 115, JSON.stringify({ e: open.json.enabled, b: open.json.balanceCents }));
    delete process.env.WALLET_ENABLED;
    if (admin) { as(admin.clerk_id); check('wallet API: an admin always has it', (await getJson()).json.enabled === true, ''); }
    as(u1.clerk_id);
    const tp = async (amountCents: any) => { const r = await routes.topup.POST(new Request('http://localhost/api/wallet/topup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents }) })); return { status: r.status, json: await r.json() }; };
    check('top-up API: refused while the wallet is closed to this user', (await tp(5000)).status === 404, '');
    process.env.WALLET_ENABLED = 'true';
    const lowAmt = await tp(1999);
    check('top-up API: $19.99 is refused with the $20 minimum message', lowAmt.status === 400 && /minimum/i.test(lowAmt.json.message), JSON.stringify(lowAmt.json));
    const savedKey = process.env.STRIPE_SECRET_KEY; delete process.env.WALLET_ALLOW_LIVE;
    process.env.STRIPE_SECRET_KEY = 'sk_live_fake_for_test';
    const live = await tp(5000);
    check('top-up API: a live Stripe key is refused (test mode only) before any Stripe call', live.status === 503 && live.json.error === 'test_mode_only', JSON.stringify(live.json));
    process.env.STRIPE_SECRET_KEY = savedKey;

    // ================= Lob client =================
    const calls: { url: string; init: any }[] = [];
    const fakeFetch = (resp: (url: string, init: any) => any) => async (url: string, init: any) => { calls.push({ url, init }); const r = resp(url, init); return { ok: r.status < 400, status: r.status, json: async () => r.body }; };
    const noKey = Lob.makeLobClient({ apiKey: '', fetchImpl: fakeFetch(() => ({ status: 200, body: {} })) });
    check('Lob: no key means not_configured, no request made', await noKey.verify({ line1: '1 A St', city: 'Miami', state: 'FL', zip: '33101' }).then(() => false, (e) => e.code === 'not_configured') && calls.length === 0, '');
    const liveKey = Lob.makeLobClient({ apiKey: 'live_abc', fetchImpl: fakeFetch(() => ({ status: 200, body: {} })) });
    delete process.env.LOB_ALLOW_LIVE;
    check('Lob: a live key is refused (test key only), no request made', await liveKey.verify({ line1: '1 A St', city: 'Miami', state: 'FL', zip: '33101' }).then(() => false, (e) => e.code === 'live_key_blocked') && calls.length === 0, '');
    const okLob = Lob.makeLobClient({ apiKey: 'test_abc', fetchImpl: fakeFetch(() => ({ status: 200, body: { deliverability: 'deliverable', primary_line: '1 A ST', components: { city: 'MIAMI', state: 'FL', zip_code: '33101', zip_code_plus_4: '1234' } } })) });
    const vr: any = await okLob.verify({ name: 'X', line1: '1 a st', city: 'miami', state: 'FL', zip: '33101' });
    check('Lob: verify uses the us_verifications endpoint with basic auth and returns the standardized address', vr.ok && calls[0].url === 'https://api.lob.com/v1/us_verifications' && calls[0].init.headers.authorization === 'Basic ' + Buffer.from('test_abc:').toString('base64') && vr.address.line1 === '1 A ST' && vr.address.zip === '33101-1234', JSON.stringify(vr));
    check('Lob verdicts: only deliverable and unnecessary-unit may be mailed', Lob.judge('deliverable').ok && Lob.judge('deliverable_unnecessary_unit').ok && !Lob.judge('undeliverable').ok && !Lob.judge('deliverable_missing_unit').ok && !Lob.judge('deliverable_incorrect_unit').ok && !Lob.judge('something_new').ok, '');

    // ================= postcards (fake Lob, real database) =================
    await S.setPrices(pool, seeded, null);
    await S.setReturnAddress(pool, { name: 'Fortune Oracle Media LLC', address_line1: '1 Sender St', address_line2: '', city: 'Miami', state: 'FL', zip: '33101' }, null);
    const addr = { name: 'Pat Owner', line1: '10 Main St', line2: '', city: 'Tampa', state: 'FL', zip: '33602' };
    const AGENT = { name: 'Alex Agent', phone: '(555) 555-0123', brokerage: 'Sunshine Realty' };
    const input = (over: any = {}) => P.postcardSchema.parse({ message: 'Interested in your land. Call me.', agent: AGENT, to: addr, ...over });
    const body = (over: any = {}) => ({ message: 'hi', agent: AGENT, to: addr, ...over });
    type Verdict = 'deliverable' | 'undeliverable' | 'deliverable_missing_unit' | 'deliverable_unnecessary_unit' | 'outage';
    const makeFake = (o: { verdict?: Verdict; createFails?: 'rejected' | 'down'; onCreate?: () => Promise<void> } = {}) => {
      const log: string[] = []; const created: any[] = []; let ledgerAtCreate = -1;
      const lob: any = {
        async verify(a: any) {
          log.push('verify');
          if (o.verdict === 'outage') throw new Lob.LobError('unavailable', 'down');
          const v = o.verdict ?? 'deliverable'; const j = Lob.judge(v);
          return j.ok ? { ok: true, deliverability: v, address: { ...a, line1: a.line1.toUpperCase() } } : { ok: false, deliverability: v, reason: j.reason };
        },
        async createPostcard(p: any) {
          log.push('create'); created.push(p);
          ledgerAtCreate = (await pool.query("select count(*)::int n from wallet_ledger where user_id=$1 and kind='charge'", [uid.current])).rows[0].n;
          if (o.onCreate) await o.onCreate();
          if (o.createFails === 'rejected') throw new Lob.LobError('rejected', 'bad content');
          if (o.createFails === 'down') throw new Lob.LobError('unavailable', 'down');
          return { id: 'psc_test_' + log.length + Math.random().toString(36).slice(2, 6) };
        },
        async cancelPostcard(id: string) { log.push('cancel:' + id.slice(0, 8)); },
      };
      return { lob: lob as import('../../lib/wallet/lob').LobClient, log, created, ledgerAtCreate: () => ledgerAtCreate };
    };
    const uid = { current: 0 };
    const pcRow = async (id: number) => (await pool.query('select * from postcards where id=$1', [id])).rows[0];

    // success
    uid.current = u1.id;
    const before = await balance(u1.id);
    const chargesBefore = (await pool.query("select count(*)::int n from wallet_ledger where user_id=$1 and kind='charge'", [u1.id])).rows[0].n;
    let f = makeFake();
    let res: any = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    const prow = res.ok ? await pcRow(res.postcardId) : null;
    check('postcard success: verified, created, then charged the admin price ($1.15)', res.ok && f.log.join() === 'verify,create' && res.chargedCents === 115 && (await balance(u1.id)) === before - 115, JSON.stringify(res));
    check('postcard success: the wallet was NOT charged yet when Lob was asked to create the card (charged only after)', f.ledgerAtCreate() === chargesBefore && (await ledgerRows(u1.id)).filter((r) => r.kind === 'charge').length === chargesBefore + 1, `charges before=${chargesBefore} at create=${f.ledgerAtCreate()}`);
    check('postcard success: record is sent, with the Lob id, cost and ledger link', prow?.status === 'sent' && prow.lob_id === res.lobId && Number(prow.cost_cents) === 115 && prow.ledger_id !== null, prow ? prow.status : 'no row');
    const lastLedger = (await ledgerRows(u1.id)).at(-1);
    check('postcard success: ledger shows one charge of -115 for item postcard_4x6 with the Lob reference', lastLedger.item === 'postcard_4x6' && Number(lastLedger.amount_cents) === -115 && lastLedger.ref === res.lobId, '');

    // bad address: no send, no charge, reason shown
    for (const [verdict, words] of [['undeliverable', /cannot deliver/i], ['deliverable_missing_unit', /apartment, suite or unit/i]] as const) {
      const b = await balance(u1.id); const n = (await ledgerRows(u1.id)).length;
      f = makeFake({ verdict });
      res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
      const row = await pcRow(res.postcardId);
      check(`address ${verdict}: not sent, not charged, reason shown, recorded`, !res.ok && res.code === 'address_rejected' && words.test(res.message) && /not (been )?charged/i.test(res.message) && !f.log.includes('create') && (await balance(u1.id)) === b && (await ledgerRows(u1.id)).length === n && row.status === 'rejected_address' && words.test(row.reason), res.message);
    }
    f = makeFake({ verdict: 'deliverable_unnecessary_unit' });
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('address with an unnecessary unit number is still mailed', res.ok === true, '');
    let b = await balance(u1.id);
    f = makeFake({ verdict: 'outage' });
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('address check unavailable: not sent, not charged', !res.ok && res.code === 'mail_failed' && !f.log.includes('create') && (await balance(u1.id)) === b, res.message);
    f = makeFake({ createFails: 'rejected' });
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('Lob refuses the card: not charged', !res.ok && res.code === 'mail_failed' && (await balance(u1.id)) === b && /not charged/i.test(res.message), res.message);
    f = makeFake({ createFails: 'down' });
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('Lob down while creating: not charged', !res.ok && (await balance(u1.id)) === b, res.message);

    // price change from admin settings takes effect
    await S.setPrices(pool, { ...seeded, postcard_4x6: { cents: 250, enabled: true } }, null);
    f = makeFake(); b = await balance(u1.id);
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('changing the postcard price in settings changes the next charge (now $2.50)', res.ok && res.chargedCents === 250 && (await balance(u1.id)) === b - 250, '');
    await S.setPrices(pool, seeded, null);

    // not enough money: nothing at all happens at Lob
    uid.current = u2.id; b = await balance(u2.id);
    check('setup: the second account has less than one postcard of balance', b === 100, String(b));
    f = makeFake(); res = await P.sendPostcard({ pool, lob: f.lob }, u2.id, input());
    check('too little balance: refused before Lob is called at all, nothing charged', !res.ok && res.code === 'insufficient_funds' && f.log.length === 0 && (await balance(u2.id)) === 100, res.message);

    // two sends at once on exactly one postcard of money
    uid.current = u3.id; await pool.query('update wallet_accounts set balance_cents = 120 where user_id=$1', [u3.id]);
    const fa = makeFake(), fb = makeFake();
    const both: any[] = await Promise.all([P.sendPostcard({ pool, lob: fa.lob }, u3.id, input()), P.sendPostcard({ pool, lob: fb.lob }, u3.id, input())]);
    const sent = both.filter((r) => r.ok).length; const created = fa.log.filter((x) => x === 'create').length + fb.log.filter((x) => x === 'create').length;
    check('two simultaneous sends on $1.20: one card goes out, one charge, balance never negative', sent === 1 && created === 1 && (await balance(u3.id)) === 5, `sent=${sent} created=${created} bal=${await balance(u3.id)}`);

    // charge fails after Lob accepted: card is cancelled, nothing charged
    uid.current = u3.id; await pool.query('update wallet_accounts set balance_cents = 200 where user_id=$1', [u3.id]);
    f = makeFake({ onCreate: async () => { await pool.query('update wallet_accounts set balance_cents = 0 where user_id=$1', [u3.id]); } });
    res = await P.sendPostcard({ pool, lob: f.lob }, u3.id, input());
    const rrow = await pcRow(res.postcardId);
    check('balance drained after Lob accepted: the card is cancelled and nothing is charged', !res.ok && f.log.some((x) => x.startsWith('cancel')) && rrow.status === 'sent_unpaid_cancel_requested' && (await balance(u3.id)) === 0, rrow.status);

    // setup missing
    uid.current = u1.id; await pool.query("update app_settings set value = '{\"name\":\"\",\"address_line1\":\"\",\"address_line2\":\"\",\"city\":\"\",\"state\":\"\",\"zip\":\"\"}'::jsonb where key='postcard_return_address'");
    f = makeFake(); b = await balance(u1.id);
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('no return address set: postcards blocked, Lob never called', !res.ok && res.code === 'not_set_up' && f.log.length === 0 && (await balance(u1.id)) === b, res.message);
    await S.setReturnAddress(pool, { name: 'Fortune Oracle Media LLC', address_line1: '1 Sender St', address_line2: '', city: 'Miami', state: 'FL', zip: '33101' }, null);
    await pool.query("delete from app_settings where key='wallet_prices'");
    f = makeFake(); res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input());
    check('no prices in settings: postcards blocked, Lob never called, nothing charged', !res.ok && res.code === 'not_set_up' && f.log.length === 0 && (await balance(u1.id)) === b, res.message);
    await S.setPrices(pool, seeded, null);

    // input validation
    check('postcard input: empty message, bad ZIP, long message and 3-letter state are refused', [{ message: '' }, { to: { ...addr, zip: '123' } }, { message: 'x'.repeat(301) }, { to: { ...addr, state: 'FLA' } }].every((o) => !P.postcardSchema.safeParse({ message: 'hi', agent: AGENT, to: addr, ...o }).success), '');

    // ---- the real route, with global fetch standing in for Lob
    const postcardRoute = async (body: any) => { const r = await routes.postcards.POST(new Request('http://localhost/api/postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, json: await r.json() }; };
    process.env.LOB_API_KEY = 'test_route_key';
    (globalThis as any).fetch = async (url: string, init: any) => {
      const body = JSON.parse(init.body || '{}');
      if (url.endsWith('/us_verifications')) return { ok: true, status: 200, json: async () => ({ deliverability: body.primary_line.toLowerCase().includes('nowhere') ? 'undeliverable' : 'deliverable', primary_line: body.primary_line, components: {} }) };
      if (url.endsWith('/postcards')) return { ok: true, status: 200, json: async () => ({ id: 'psc_route_1' }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    as(u1.clerk_id); process.env.WALLET_ENABLED = 'true'; b = await balance(u1.id);
    const bad = await postcardRoute(body({ to: { ...addr, line1: '99 Nowhere Rd' } }));
    check('postcard API: undeliverable address is 422 with the reason, and no charge', bad.status === 422 && /cannot deliver/i.test(bad.json.message) && (await balance(u1.id)) === b, JSON.stringify(bad.json));
    const good = await postcardRoute(body());
    check('postcard API: good address is 200 and charges $1.15', good.status === 200 && good.json.chargedCents === 115 && (await balance(u1.id)) === b - 115, JSON.stringify(good.json));
    check('postcard API: invalid input is 400', (await postcardRoute(body({ message: '' }))).status === 400, '');
    as(u2.clerk_id);
    const poor = await postcardRoute(body());
    check('postcard API: not enough balance is 402', poor.status === 402 && poor.json.error === 'insufficient_funds', JSON.stringify(poor.json));
    delete process.env.WALLET_ENABLED; as(u1.clerk_id);
    check('postcard API: closed to normal users while the wallet is off', (await postcardRoute(body())).status === 404, '');
    as(null);
    check('postcard API: signed out is 401', (await postcardRoute(body())).status === 401, '');
    (globalThis as any).fetch = origFetch; delete process.env.LOB_API_KEY;

    // ================= sizes, per-size prices, First Class =================
    await S.setPrices(pool, seeded, null);
    await S.setReturnAddress(pool, { name: 'Fortune Oracle Media LLC', address_line1: '1 Sender St', address_line2: '', city: 'Miami', state: 'FL', zip: '33101' }, null);
    uid.current = u1.id;
    await fund(u1.id, 10000, 'big');
    for (const [size, cents] of [['6x9', 130], ['6x11', 155], ['4x6', 115]] as const) {
      f = makeFake(); b = await balance(u1.id);
      res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input({ size }));
      check(`size ${size}: charged its own settings price (${(cents / 100).toFixed(2)})`, res.ok && res.chargedCents === cents && (await balance(u1.id)) === b - cents, JSON.stringify(res));
    }
    f = makeFake();
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input({ size: '6x11', design: 'bold', propertyAddress: '1 Main St', acreage: 8 }));
    const call = f.created[0]; const prow2 = await pcRow(res.postcardId);
    check('Lob is asked for the chosen size, with that size\'s page dimensions on both sides', call.size === '6x11' && call.front.includes('width:11.25in;height:6.25in') && call.back.includes('width:11.25in;height:6.25in') && call.front.includes('8 ACRES'), call.size);
    check('the postcard record keeps size, design, First Class and the merge fields (never the images)', prow2.size === '6x11' && prow2.design === 'bold' && prow2.mail_type === 'usps_first_class' && prow2.spec.acreage === 8 && prow2.spec.propertyAddress === '1 Main St' && !JSON.stringify(prow2.spec).includes('base64'), JSON.stringify(prow2.spec));
    await S.setPrices(pool, { ...seeded, postcard_6x9: { cents: 999, enabled: true } }, null);
    f = makeFake(); b = await balance(u1.id);
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input({ size: '6x9' }));
    check('admin changes the 6x9 price: next 6x9 card costs $9.99, other sizes unchanged', res.ok && res.chargedCents === 999 && (await balance(u1.id)) === b - 999, '');
    await S.setPrices(pool, { ...seeded, postcard_6x9: { cents: 130, enabled: false } }, null);
    f = makeFake(); b = await balance(u1.id);
    res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input({ size: '6x9' }));
    check('a size switched off in settings cannot be sent: Lob never called, nothing charged', !res.ok && res.code === 'not_set_up' && f.log.length === 0 && (await balance(u1.id)) === b, res.message);
    f = makeFake(); res = await P.sendPostcard({ pool, lob: f.lob }, u1.id, input({ size: '4x6' }));
    check('...while the other sizes still work', res.ok === true, '');
    await S.setPrices(pool, seeded, null);

    const lobCalls: any[] = [];
    const firstClassLob = Lob.makeLobClient({ apiKey: 'test_abc', fetchImpl: async (url: string, init: any) => { lobCalls.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ id: 'psc_x' }) }; } });
    for (const size of ['4x6', '6x9', '6x11'] as const) {
      lobCalls.length = 0;
      await firstClassLob.createPostcard({ to: { name: 'A', line1: '1 A St', city: 'Miami', state: 'FL', zip: '33101' }, from: { name: 'B', line1: '2 B St', city: 'Miami', state: 'FL', zip: '33101' }, front: '<html></html>', back: '<html></html>', size, description: 'd', idempotencyKey: 'k1' });
      const c0 = lobCalls[0];
      check(`Lob request for ${size}: First Class, marketing, this size, idempotency key`, c0.url === 'https://api.lob.com/v1/postcards' && c0.body.mail_type === 'usps_first_class' && c0.body.size === size && c0.body.use_type === 'marketing' && c0.init.headers['Idempotency-Key'] === 'k1', JSON.stringify({ m: c0.body.mail_type, s: c0.body.size }));
    }

    // ================= generic charge door for any paid service =================
    const Cg = await import('../../lib/wallet/charge');
    let bal0 = await balance(u1.id);
    let cr: any = await Cg.chargeForService(pool, { userId: u1.id, item: 'skip_trace', idempotencyKey: `${tag}:st1` });
    check('generic charge: a switched-off item (skip trace) cannot be charged; balance unchanged, nothing recorded', !cr.ok && cr.reason === 'disabled' && (await balance(u1.id)) === bal0 && (await ledgerRows(u1.id)).filter((r) => r.item === 'skip_trace').length === 0, JSON.stringify(cr));
    await S.setPrices(pool, { ...seeded, property_data: { cents: 20, enabled: true } }, null);
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', idempotencyKey: `${tag}:pd1`, description: 'Property data' });
    check('generic charge: an enabled item is charged its settings price ($0.20), recorded with its item name', cr.ok && cr.chargedCents === 20 && (await balance(u1.id)) === bal0 - 20 && (await ledgerRows(u1.id)).some((r) => r.item === 'property_data' && Number(r.amount_cents) === -20), JSON.stringify(cr));
    const crDup: any = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', idempotencyKey: `${tag}:pd1` });
    check('generic charge: the same idempotency key charges once', crDup.ok && crDup.duplicate && (await balance(u1.id)) === bal0 - 20, '');
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', quantity: 3, idempotencyKey: `${tag}:pd3` });
    check('generic charge: quantity multiplies the price (3 x $0.20)', cr.ok && cr.chargedCents === 60, JSON.stringify(cr));
    cr = await Cg.chargeForService(pool, { userId: u2.id, item: 'property_data', quantity: 10, idempotencyKey: `${tag}:pd10` });
    check('generic charge: more than the balance is refused (balance unchanged)', !cr.ok && cr.reason === 'insufficient' && (await balance(u2.id)) === 100, JSON.stringify(cr));
    await S.setPrices(pool, { ...seeded, property_data: { cents: 50, enabled: true } }, null);
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', idempotencyKey: `${tag}:pd50` });
    check('generic charge: a changed price applies to the next charge ($0.50)', cr.ok && cr.chargedCents === 50, JSON.stringify(cr));
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', quotedCents: 35, idempotencyKey: `${tag}:pdq` });
    check('generic charge: a quoted price is honoured (the user pays what they were shown)', cr.ok && cr.chargedCents === 35, JSON.stringify(cr));
    await S.setPrices(pool, { ...seeded, permit: { cents: 0, enabled: true } }, null);
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'permit', idempotencyKey: `${tag}:pz` });
    check('generic charge: an item enabled at $0 is refused (nothing is free by accident)', !cr.ok && cr.reason === 'not_priced', JSON.stringify(cr));
    await S.setPrices(pool, seeded, null);
    await pool.query("delete from app_settings where key='wallet_prices'");
    cr = await Cg.chargeForService(pool, { userId: u1.id, item: 'property_data', idempotencyKey: `${tag}:pnone` });
    check('generic charge: with no prices row, nothing is charged', !cr.ok && cr.reason === 'settings', JSON.stringify(cr));
    await S.setPrices(pool, seeded, null);

    // ================= uploads: logo and photo =================
    const Asset = await import('../../lib/wallet/assets');
    const sharp = (await import('sharp')).default;
    const mkPng = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 10, g: 80, b: 160, alpha: 0.5 } } }).png().toBuffer();
    const mkJpg = (w: number, h: number, mark?: string) => { let p = sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }); if (mark) p = (p as any).withExif({ IFD0: { Copyright: mark } }); return p.jpeg().toBuffer(); };
    check('file type is decided by the bytes: PNG and JPEG pass; SVG, GIF, PDF, text and empty do not', Asset.sniffImage(await mkPng(10, 10)) === 'image/png' && Asset.sniffImage(await mkJpg(10, 10)) === 'image/jpeg' && [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), Buffer.from('GIF89a......'), Buffer.from('%PDF-1.4 ....'), Buffer.from('hello world, not an image'), Buffer.alloc(0)].every((x) => Asset.sniffImage(x) === null), '');
    const logoOut = await Asset.processImage(await mkPng(3000, 2000), 'logo');
    const logoMeta = await sharp(logoOut.bytes).metadata();
    check('logo: resized to 800 px at most, stays PNG, keeps transparency', logoOut.mime === 'image/png' && Math.max(logoOut.width, logoOut.height) <= 800 && logoMeta.hasAlpha === true, `${logoOut.width}x${logoOut.height}`);
    const marker = 'SECRETGPSMARK';
    const withExif = await mkJpg(5000, 3000, marker);
    const exifKept = withExif.includes(Buffer.from(marker));
    const photoOut = await Asset.processImage(withExif, 'photo');
    check('photo: resized to 2400 px at most and saved as JPEG', photoOut.mime === 'image/jpeg' && Math.max(photoOut.width, photoOut.height) <= 2400 && Math.max(photoOut.width, photoOut.height) >= 2000, `${photoOut.width}x${photoOut.height}`);
    check('photo: hidden camera data is removed (the marker was in the upload, is not in the result)', exifKept && !photoOut.bytes.includes(Buffer.from(marker)) && !(await sharp(photoOut.bytes).metadata()).exif, `inInput=${exifKept}`);
    check('a small photo is accepted with a low-resolution warning', (await Asset.processImage(await mkJpg(800, 500), 'photo')).warnings.some((w) => /low resolution/i.test(w)), '');
    const refused = async (buf: Buffer, kind: any = 'logo') => Asset.processImage(buf, kind).then(() => false, (e) => e instanceof Asset.AssetError);
    check('uploads refused: SVG, GIF, text, empty, damaged PNG, 50 px image, over 4 MB', (await Promise.all([refused(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script></svg>')), refused(Buffer.from('GIF89a' + 'x'.repeat(2000))), refused(Buffer.from('just text '.repeat(100))), refused(Buffer.alloc(0)), refused(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('not really a png'.repeat(50))])), refused(await mkPng(50, 50)), refused(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4 * 1024 * 1024 + 1)]))])).every(Boolean), '');
    const logoId = await Asset.saveAsset(pool, u1.id, 'logo', logoOut);
    const photoId = await Asset.saveAsset(pool, u1.id, 'photo', photoOut);
    const own = await Asset.loadImages(pool, u1.id, { logo: logoId, photo: photoId });
    check('an account can load its own uploads as embedded images', own.logo!.startsWith('data:image/png;base64,') && own.photo!.startsWith('data:image/jpeg;base64,'), '');
    const loadFails = (uid2: number, ids: any) => Asset.loadImages(pool, uid2, ids).then(() => false, (e) => e instanceof Asset.AssetError);
    check("another account cannot use someone else's upload; the wrong kind and a missing id are refused too", (await loadFails(u2.id, { logo: logoId })) && (await loadFails(u1.id, { photo: logoId })) && (await loadFails(u1.id, { logo: 999999999 })), '');

    // ================= preview and upload routes, then a send with images =================
    const lobPosts: any[] = [];
    (globalThis as any).fetch = async (url: string, init: any) => {
      const b = JSON.parse(init.body || '{}');
      if (url.endsWith('/us_verifications')) return { ok: true, status: 200, json: async () => ({ deliverability: 'deliverable', primary_line: b.primary_line, components: {} }) };
      if (url.endsWith('/postcards')) { lobPosts.push(b); return { ok: true, status: 200, json: async () => ({ id: 'psc_img_1' }) }; }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    process.env.LOB_API_KEY = 'test_route_key'; process.env.WALLET_ENABLED = 'true';
    const upload = async (clerk: string | null, kind: string, buf: Buffer, name = 'x.png', type = 'image/png') => {
      as(clerk); const fd = new FormData(); fd.append('kind', kind); fd.append('file', new File([new Uint8Array(buf)], name, { type }));
      const r = await routes.assets.POST(new Request('http://localhost/api/postcards/assets', { method: 'POST', body: fd })); return { status: r.status, json: await r.json() };
    };
    const up = await upload(u1.clerk_id, 'logo', await mkPng(600, 300), 'logo.png');
    check('upload route: a real PNG logo is accepted and returns an id', up.status === 200 && up.json.id > 0 && up.json.kind === 'logo', JSON.stringify(up.json));
    const upBad = await upload(u1.clerk_id, 'logo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), 'logo.png', 'image/png');
    check('upload route: an SVG renamed .png is refused', upBad.status === 400 && upBad.json.error === 'bad_image', JSON.stringify(upBad.json));
    check('upload route: unknown kind is 400, signed out is 401', (await upload(u1.clerk_id, 'banner', await mkPng(300, 300))).status === 400 && (await upload(null, 'logo', await mkPng(300, 300))).status === 401, '');
    delete process.env.WALLET_ENABLED;
    check('upload route: closed to normal users while the wallet is off', (await upload(u1.clerk_id, 'logo', await mkPng(300, 300))).status === 404, '');
    process.env.WALLET_ENABLED = 'true';

    const pv = async (clerk: string | null, b: any) => { as(clerk); const r = await routes.preview.POST(new Request('http://localhost/api/postcards/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })); return { status: r.status, json: await r.json() }; };
    const cardsBefore = Number((await pool.query('select count(*)::int n from postcards where user_id=$1', [u1.id])).rows[0].n); const ledgerBefore = (await ledgerRows(u1.id)).length; const balBefore = await balance(u1.id); lobPosts.length = 0;
    const pre = await pv(u1.clerk_id, body({ size: '6x9', design: 'friendly', propertyAddress: '12 CR 4', acreage: 10, logoAssetId: up.json.id, photoAssetId: photoId, message: 'Hi {{owner_name}}, I saw your {{acreage}} acres at {{property_address}}.' }));
    check('preview route: returns the exact front and back HTML with the logo and photo embedded, the merged message, price and affordability', pre.status === 200 && pre.json.front.includes('data:image/jpeg;base64') && pre.json.back.includes('data:image/png;base64') && pre.json.back.includes('Hi Pat Owner, I saw your 10 acres at 12 CR 4.') && pre.json.widthIn === 9.25 && pre.json.priceCents === 130 && pre.json.available === true && pre.json.canAfford === true, JSON.stringify({ s: pre.status, p: pre.json.priceCents }));
    check('preview route is free: no card saved, no ledger row, no balance change, Lob never called', Number((await pool.query('select count(*)::int n from postcards where user_id=$1', [u1.id])).rows[0].n) === cardsBefore && (await ledgerRows(u1.id)).length === ledgerBefore && (await balance(u1.id)) === balBefore && lobPosts.length === 0, '');
    check('preview route: missing required agent details, bad merge field and a stranger\'s upload are all refused', (await pv(u1.clerk_id, { ...body(), agent: { name: '', phone: '', brokerage: '' } })).status === 400 && (await pv(u1.clerk_id, body({ message: 'Hi {{nope}}' }))).status === 400 && (await pv(u2.clerk_id, body({ logoAssetId: up.json.id }))).json.error === 'bad_image', '');
    const poorPre = await pv(u2.clerk_id, body({ size: '6x11' }));
    check('preview route: a balance too small for the size says so (canAfford false) but still previews', poorPre.status === 200 && poorPre.json.priceCents === 155 && poorPre.json.canAfford === false, JSON.stringify({ c: poorPre.json.canAfford }));
    check('preview route: signed out is 401, closed wallet is 404', (await pv(null, body())).status === 401 && (delete process.env.WALLET_ENABLED, (await pv(u1.clerk_id, body())).status === 404), '');
    process.env.WALLET_ENABLED = 'true';

    as(u1.clerk_id); b = await balance(u1.id); lobPosts.length = 0;
    const sentImg = await postcardRoute(body({ size: '6x9', design: 'classic', logoAssetId: up.json.id, photoAssetId: photoId, propertyAddress: '12 CR 4', acreage: 10 }));
    check('send route with a logo and photo: 200, charged $1.30, and Lob received First Class 6x9 HTML with both images inside', sentImg.status === 200 && sentImg.json.chargedCents === 130 && (await balance(u1.id)) === b - 130 && lobPosts.length === 1 && lobPosts[0].mail_type === 'usps_first_class' && lobPosts[0].size === '6x9' && lobPosts[0].front.includes('data:image/jpeg;base64') && lobPosts[0].back.includes('data:image/png;base64'), JSON.stringify(sentImg.json));
    lobPosts.length = 0; as(u2.clerk_id);
    const stolen = await postcardRoute(body({ logoAssetId: up.json.id }));
    check("send route: using another account's upload is refused before anything is sent", stolen.status === 400 && stolen.json.error === 'bad_image' && lobPosts.length === 0, JSON.stringify(stolen.json));
    (globalThis as any).fetch = origFetch; delete process.env.LOB_API_KEY;
    as(null); delete process.env.WALLET_ENABLED;

    // ---- skip trace is untouched by the wallet
    const st = await import('../../lib/skiptrace/service');
    delete process.env.SKIPTRACE_ENABLED;
    check('skip trace is still behind its own flag (off)', st.skipTraceEnabled() === false, '');
    const wsrc = ['lib/wallet/ledger.ts', 'lib/wallet/charge.ts', 'lib/wallet/postcards.ts', 'lib/wallet/templates.ts', 'lib/wallet/topup.ts', 'app/api/wallet/route.ts', 'app/api/postcards/route.ts', 'app/api/postcards/preview/route.ts'].map((p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8')).join('\n');
    check('the wallet code does not call skip tracing', !/skiptrace/i.test(wsrc), '');
  } catch (e: any) {
    check('test run completed without crashing', false, String(e?.stack || e).slice(0, 400));
  } finally {
    (globalThis as any).fetch = origFetch;
    for (const k of Object.keys(process.env)) if (!(k in origEnv)) delete process.env[k];
    Object.assign(process.env, origEnv);
    await pool.query('delete from stripe_events where id like $1', ['evt_test_' + tag + '%']).catch(() => {});
    await pool.query('delete from users where id = any($1::int[])', [[u1.id, u2.id, u3.id]]).catch((e) => check('cleanup of test users', false, String(e)));
    await restoreSettings().catch(() => {});
    console.log(results.join('\n'));
    const fails = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - fails} passed, ${fails} failed`);
    await pool.end();
    process.exit(fails ? 1 : 0);
  }
})();
