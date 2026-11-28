// Refunds and disputes on wallet top-ups (lib/wallet/disputes.ts), through the REAL Stripe webhook route with validly signed fake events, on the DEV database
// (public schema; applies migrations 017, 018, 020, 021, 022 there, all idempotent). Throwaway users (wallets cascade); settings rows restored. No network, no real money.
// Also proves a frozen wallet is refused by every spending door (holds, charges, top-up route, postcards, skip trace) and the admin tools.
// Never touches app_prod. Usage: npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-wallet-disputes.ts
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
  for (const f of ['016_skip_trace.sql', '017_wallet.sql', '018_postcard_sizes.sql', '020_wallet_holds.sql', '021_skiptrace_wallet.sql', '022_wallet_refunds_disputes.sql']) {
    await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8'));
  }
  const L = await import('../../lib/wallet/ledger');
  const Cg = await import('../../lib/wallet/charge');
  const S = await import('../../lib/wallet/settings');
  const D = await import('../../lib/wallet/disputes');
  const AD = await import('../../lib/wallet/admin');
  const P = await import('../../lib/wallet/postcards');
  const svc = await import('../../lib/skiptrace/service');
  const webhook = await import('../../app/api/webhooks/stripe/route');
  const topupRoute = await import('../../app/api/wallet/topup/route');
  const walletRoute = await import('../../app/api/wallet/route');
  const { stripe } = await import('../../lib/stripe');

  const orig = (await pool.query("select key, value from app_settings where key in ('wallet_prices','postcard_return_address','skiptrace_options')")).rows;
  if (!orig.some((r) => r.key === 'wallet_prices')) { console.log('FAIL  dev database has no wallet_prices row (run the wallet tests first)'); process.exit(1); }
  const restoreSettings = async () => {
    await pool.query("delete from app_settings where key in ('wallet_prices','postcard_return_address','skiptrace_options')");
    for (const r of orig) await pool.query('insert into app_settings (key, value) values ($1,$2::jsonb)', [r.key, JSON.stringify(r.value)]);
  };
  const base: any = await S.getPrices(pool);
  await S.setPrices(pool, { ...base, skip_trace: { cents: 15, enabled: true }, skip_trace_dnc: { cents: 5, enabled: false }, property_data: { cents: 100, enabled: true } }, null);
  await S.setReturnAddress(pool, { name: 'Fortune Oracle Media LLC', address_line1: '1 Sender St', address_line2: '', city: 'Miami', state: 'FL', zip: '33101' }, null);
  await pool.query("delete from app_settings where key='skiptrace_options'");

  const as = (id: string | null) => { if (id) process.env.TEST_CLERK_ID = id; else delete process.env.TEST_CLERK_ID; };
  const tag = 'test_disputes_' + Date.now();
  const mk = async (n: string) => (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id, clerk_id", [`${tag}_${n}`, `${tag}_${n}@example.invalid`])).rows[0] as { id: number; clerk_id: string };
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const U: Record<string, { id: number; clerk_id: string }> = {};
  for (const n of names) U[n] = await mk(n);
  const users = Object.values(U).map((u) => u.id);
  const origEnv = { ...process.env };
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_' + tag;
  process.env.SKIPTRACE_PROVIDER = 'mock';

  let seq = 0;
  const hook = async (type: string, obj: any, livemode = false) => {
    const body = JSON.stringify({ id: `evt_test_${tag}_${++seq}`, object: 'event', type, livemode, data: { object: obj } });
    sigHeader = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return (await webhook.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }))).status;
  };
  const sameEvent = async (type: string, obj: any, id: string) => {
    const body = JSON.stringify({ id, object: 'event', type, livemode: false, data: { object: obj } });
    sigHeader = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return (await webhook.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }))).status;
  };
  let piN = 0;
  /** A paid top-up arriving through the webhook, like production. Returns the Stripe ids so a refund or dispute can refer to it. */
  const topup = async (u: { id: number; clerk_id: string }, cents: number) => {
    const n = ++piN; const pi = `pi_test_${tag}_${n}`, ch = `ch_test_${tag}_${n}`, cs = `cs_test_${tag}_${n}`;
    const status = await hook('checkout.session.completed', { id: cs, object: 'checkout.session', mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: cents, client_reference_id: u.clerk_id, payment_intent: pi, metadata: { kind: 'wallet_topup', userId: u.clerk_id, amountCents: String(cents) } });
    return { pi, ch, cs, status };
  };
  const refund = (t: { pi: string; ch: string }, cents: number, total: number) => hook('charge.refunded', { id: t.ch, object: 'charge', payment_intent: t.pi, amount: cents, amount_refunded: total });
  let dN = 0;
  const dispute = (t: { pi: string; ch: string }, cents: number, status = 'needs_response', id?: string) => {
    const did = id ?? `dp_test_${tag}_${++dN}`;
    return { id: did, object: 'dispute', charge: t.ch, payment_intent: t.pi, amount: cents, reason: 'fraudulent', status, evidence_details: { due_by: Math.floor(Date.now() / 1000) + 7 * 86400 } };
  };
  const bal = (u: { id: number }) => L.getBalance(pool, u.id);
  const held = (u: { id: number }) => L.getHeld(pool, u.id);
  const frozen = async (u: { id: number }) => (await L.getFrozen(pool, u.id)).frozen;
  const ledger = async (u: { id: number }) => (await pool.query('select kind, amount_cents, description from wallet_ledger where user_id=$1 order by id', [u.id])).rows;
  const incidents = async (u: { id: number }, kind?: string) => (await pool.query(`select * from wallet_incidents where user_id=$1 ${kind ? 'and kind=$2' : ''} order by id`, kind ? [u.id, kind] : [u.id])).rows;
  const dbDispute = async (id: string) => (await pool.query('select * from wallet_disputes where stripe_dispute_id=$1', [id])).rows[0];

  const cleanup = async () => {
    await pool.query('delete from stripe_events where id like $1', ['evt_test_' + tag + '%']).catch(() => {});
    await pool.query('delete from users where id = any($1::int[])', [users]).catch((e) => check('cleanup of test users', false, String(e)));
    await restoreSettings().catch(() => {});
    for (const k of Object.keys(process.env)) if (!(k in origEnv)) delete process.env[k];
    Object.assign(process.env, origEnv);
  };

  try {
    // ================= a credited top-up remembers its Stripe payment
    const tA = await topup(U.a, 5000);
    check('top-up through the webhook: credited $50.00 and the Stripe payment is remembered', tA.status === 200 && (await bal(U.a)) === 5000 && (await pool.query('select amount_cents from wallet_topups where payment_intent=$1 and user_id=$2', [tA.pi, U.a.id])).rows[0]?.amount_cents === '5000', String(await bal(U.a)));
    const csReplay = await hook('checkout.session.completed', { id: tA.cs, object: 'checkout.session', mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 5000, client_reference_id: U.a.clerk_id, payment_intent: tA.pi, metadata: { kind: 'wallet_topup', userId: U.a.clerk_id, amountCents: '5000' } });
    check('the same payment arriving again (a new event) credits nothing more and records one row', csReplay === 200 && (await bal(U.a)) === 5000 && (await pool.query('select 1 from wallet_topups where user_id=$1', [U.a.id])).rowCount === 1, '');

    // ================= refunds
    // a spent $0.20 of the $50 first (a lookup, hold then charge)
    const sp: any = await Cg.reserveForService(pool, { userId: U.a.id, item: 'skip_trace', quantity: 1, idempotencyKey: `${tag}:sa1` });
    await Cg.settleHold(pool, sp.holdId);
    await pool.query('update wallet_ledger set item = item where user_id = $1', [U.a.id]);
    // top the spent amount to $0.20 with a direct charge of $0.05
    await Cg.chargeForService(pool, { userId: U.a.id, item: 'skip_trace', quotedCents: 5, idempotencyKey: `${tag}:sa2` });
    check('setup: $50 top-up, $0.20 spent, balance $49.80', (await bal(U.a)) === 4980, String(await bal(U.a)));
    const evId = `evt_test_${tag}_refundA`;
    const rfA = { id: tA.ch, object: 'charge', payment_intent: tA.pi, amount: 5000, amount_refunded: 5000 };
    check('refund of the whole $50 payment: webhook 200', (await sameEvent('charge.refunded', rfA, evId)) === 200, '');
    check('the wallet gives back what is still there ($49.80); the $0.20 already spent is a shortfall', (await bal(U.a)) === 0 && (await ledger(U.a)).some((r) => r.kind === 'refund' && r.amount_cents === '-4980'), JSON.stringify((await ledger(U.a)).slice(-1)));
    const sfA = await incidents(U.a, 'refund_shortfall');
    check('an incident records the $0.20 shortfall with the explanation', sfA.length === 1 && sfA[0].amount_cents === '20' && sfA[0].status === 'open' && /already spent/.test(sfA[0].note), JSON.stringify(sfA.map((i) => i.amount_cents)));
    check('a refund does not pause the wallet', !(await frozen(U.a)), '');
    check('the same event delivered twice changes nothing', (await sameEvent('charge.refunded', rfA, evId)) === 200 && (await bal(U.a)) === 0 && (await incidents(U.a, 'refund_shortfall')).length === 1, '');
    check('a second event with the same total (a replay by another id) is ignored', (await hook('charge.refunded', rfA)) === 200 && (await bal(U.a)) === 0 && (await ledger(U.a)).filter((r) => r.kind === 'refund').length === 1, '');
    check('the refunded total is remembered on the top-up', (await pool.query('select refunded_cents from wallet_topups where payment_intent=$1', [tA.pi])).rows[0].refunded_cents === '5000', '');

    // partial refunds, cumulative, and an old event arriving late
    const tB = await topup(U.b, 5000);
    await refund(tB, 5000, 1000);
    check('partial refund $10 of $50 -> wallet $40', (await bal(U.b)) === 4000, String(await bal(U.b)));
    await refund(tB, 5000, 2500);
    check('a later event with the running total $25 takes only the new $15 -> $25', (await bal(U.b)) === 2500 && (await ledger(U.b)).filter((r) => r.kind === 'refund').length === 2, String(await bal(U.b)));
    await refund(tB, 5000, 1000);
    check('an OLDER event arriving late (total $10) is ignored', (await bal(U.b)) === 2500, String(await bal(U.b)));
    check('no shortfall incident when the wallet could cover it', (await incidents(U.b)).length === 0, '');

    // money set aside for a service in progress cannot be taken
    const tC = await topup(U.c, 2000);
    const hc: any = await Cg.reserveForService(pool, { userId: U.c.id, item: 'property_data', idempotencyKey: `${tag}:hc` }); // $1.00 held
    await refund(tC, 2000, 2000);
    check('refund of $20 when $1.00 is set aside: takes $19.00, the held $1.00 stays, shortfall $1.00 recorded', (await bal(U.c)) === 100 && (await held(U.c)) === 100 && (await incidents(U.c, 'refund_shortfall'))[0]?.amount_cents === '100', `bal ${await bal(U.c)} held ${await held(U.c)}`);
    check('...and the service in progress can still settle', ((await Cg.settleHold(pool, hc.holdId)) as any).ok && (await bal(U.c)) === 0, '');

    // not a wallet payment: ignored, nothing moves
    const before = await bal(U.b);
    check('a refund for a charge that is not a wallet top-up (a subscription) is ignored', (await hook('charge.refunded', { id: 'ch_sub', object: 'charge', payment_intent: 'pi_subscription_x', amount: 7900, amount_refunded: 7900 })) === 200 && (await bal(U.b)) === before, '');

    // ================= disputes
    const tD = await topup(U.d, 5000);
    const dD = dispute(tD, 5000);
    check('dispute opened: webhook 200', (await hook('charge.dispute.created', dD)) === 200, '');
    const rowD = await dbDispute(dD.id);
    check('the disputed $50 is taken back at once, the wallet is paused, and the dispute is recorded', (await bal(U.d)) === 0 && (await frozen(U.d)) && rowD.status === 'open' && rowD.debited_cents === '5000' && rowD.shortfall_cents === '0', JSON.stringify(rowD));
    check('an incident tells you to respond in Stripe and when the evidence is due', (await incidents(U.d, 'dispute_open')).length === 1 && /respond in the Stripe dashboard/i.test((await incidents(U.d, 'dispute_open'))[0].note) && /Evidence due/.test((await incidents(U.d, 'dispute_open'))[0].note), '');
    check('the customer sees a neutral line in their history (no accusation)', (await ledger(U.d)).some((r) => r.amount_cents === '-5000' && /dispute/i.test(r.description) && !/fraud/i.test(r.description)), JSON.stringify((await ledger(U.d)).slice(-1)));
    check('the same dispute event again changes nothing', (await hook('charge.dispute.created', dD)) === 200 && (await bal(U.d)) === 0 && (await incidents(U.d, 'dispute_open')).length === 1, '');

    // a frozen wallet is refused by every door that starts spending
    await L.inTx(pool, (c) => L.credit(c, { userId: U.d.id, cents: 3000, kind: 'adjustment', idempotencyKey: `${tag}:dfund` })); // money in is still allowed
    check('money can still be added to a paused wallet (credit by an admin or webhook)', (await bal(U.d)) === 3000, '');
    const rsv: any = await Cg.reserveForService(pool, { userId: U.d.id, item: 'skip_trace', idempotencyKey: `${tag}:dfrz1` });
    check('paused wallet: a hold is refused (frozen), nothing held', !rsv.ok && rsv.reason === 'frozen' && (await held(U.d)) === 0, JSON.stringify(rsv));
    const chg: any = await Cg.chargeForService(pool, { userId: U.d.id, item: 'property_data', idempotencyKey: `${tag}:dfrz2` });
    check('paused wallet: a direct charge is refused (frozen), balance untouched', !chg.ok && chg.reason === 'frozen' && (await bal(U.d)) === 3000, JSON.stringify(chg));
    process.env.WALLET_ENABLED = 'true';
    as(U.d.clerk_id);
    const tp = await topupRoute.POST(new Request('http://localhost/api/wallet/topup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents: 5000 }) }));
    const tpj = await tp.json();
    check('paused wallet: the top-up route refuses (403 wallet_frozen) before any Stripe call', tp.status === 403 && tpj.error === 'wallet_frozen', JSON.stringify(tpj));
    const wj = await (await walletRoute.GET()).json();
    check('the wallet screen is told it is paused (and no reason is given)', wj.frozen === true && !JSON.stringify(wj).includes('dispute:'), JSON.stringify({ f: wj.frozen }));
    let lobCalls = 0;
    const lob: any = { async verify(a: any) { lobCalls++; return { ok: true, deliverability: 'deliverable', address: a }; }, async createPostcard() { lobCalls++; return { id: 'psc_test' }; }, async cancelPostcard() {} };
    const pc = await P.sendPostcard({ pool, lob }, U.d.id, P.postcardSchema.parse({ message: 'hello', agent: { name: 'Alex Agent', phone: '(555) 555-0123', brokerage: 'Sunshine Realty' }, to: { name: 'Pat Owner', line1: '10 Main St', city: 'Tampa', state: 'FL', zip: '33602' } }));
    check('paused wallet: a postcard is refused (wallet_frozen) before any address check or Lob call', !pc.ok && pc.code === 'wallet_frozen' && lobCalls === 0, JSON.stringify(pc));
    process.env.SKIPTRACE_ENABLED = 'true';
    const st: any = await svc.lookupContact(U.d.id, { name: `${tag} paused owner`, mailingAddress: '1 TEST ST MIAMI FL 33101' }).then(() => null, (e) => e);
    check('paused wallet: a skip trace lookup is refused (wallet_frozen, 403), the vendor is never called', st?.code === 'wallet_frozen' && st.status === 403 && (await held(U.d)) === 0, `${st?.code}`);
    delete process.env.SKIPTRACE_ENABLED; delete process.env.WALLET_ENABLED; as(null);

    // won: money returned, wallet un-paused
    const closeWon = { ...dD, status: 'won' };
    check('dispute won: webhook 200', (await hook('charge.dispute.closed', closeWon)) === 200, '');
    check('the $50 is returned, the wallet is active again, the dispute is marked won', (await bal(U.d)) === 8000 && !(await frozen(U.d)) && (await dbDispute(dD.id)).status === 'won' && (await dbDispute(dD.id)).reinstated_cents === '5000', String(await bal(U.d)));
    check('the open incidents for that dispute are closed automatically', (await incidents(U.d, 'dispute_open')).every((i) => i.status === 'resolved'), '');
    check('the same close event again returns nothing twice', (await hook('charge.dispute.closed', closeWon)) === 200 && (await bal(U.d)) === 8000, String(await bal(U.d)));
    const ok2: any = await Cg.reserveForService(pool, { userId: U.d.id, item: 'skip_trace', idempotencyKey: `${tag}:dok` });
    check('after the win the customer can spend again', ok2.ok === true, JSON.stringify(ok2));
    await Cg.releaseHold(pool, ok2.holdId);

    // lost: money stays gone, wallet stays paused, incident for you
    const tE = await topup(U.e, 2000);
    const dE = dispute(tE, 2000);
    await hook('charge.dispute.created', dE);
    await hook('charge.dispute.closed', { ...dE, status: 'lost' });
    const lostInc = await incidents(U.e, 'dispute_lost');
    check('dispute lost: the money stays taken back, the wallet stays paused, the dispute is marked lost', (await bal(U.e)) === 0 && (await frozen(U.e)) && (await dbDispute(dE.id)).status === 'lost', '');
    check('...and an incident says you lost it, that Stripe keeps the money plus a fee, and that you decide about un-pausing', lostInc.length === 1 && lostInc[0].status === 'open' && /LOST/.test(lostInc[0].note) && /fee/.test(lostInc[0].note) && /unpause/i.test(lostInc[0].note), lostInc[0]?.note);
    check('the "respond in Stripe" incident is closed once the dispute ends', (await incidents(U.e, 'dispute_open')).every((i) => i.status === 'resolved'), '');

    // part already spent: shortfall, and a win returns only what was taken
    const tF = await topup(U.f, 2000);
    await Cg.chargeForService(pool, { userId: U.f.id, item: 'property_data', quantity: 19, idempotencyKey: `${tag}:fspend` }); // $19.00 spent, $1.00 left
    const dF = dispute(tF, 2000);
    await hook('charge.dispute.created', dF);
    check('dispute for $20 when $1 is left: takes $1, records the $19 shortfall (own incident), pauses', (await bal(U.f)) === 0 && (await dbDispute(dF.id)).debited_cents === '100' && (await dbDispute(dF.id)).shortfall_cents === '1900' && (await incidents(U.f, 'dispute_shortfall'))[0]?.amount_cents === '1900' && (await frozen(U.f)), JSON.stringify(await dbDispute(dF.id)));
    await hook('charge.dispute.closed', { ...dF, status: 'won' });
    check('won: only the $1 that was taken is returned, the shortfall incident is closed, the wallet is active', (await bal(U.f)) === 100 && !(await frozen(U.f)) && (await incidents(U.f, 'dispute_shortfall'))[0].status === 'resolved', String(await bal(U.f)));

    // an inquiry (no money has moved)
    const tG = await topup(U.g, 2000);
    const dG = dispute(tG, 2000, 'warning_needs_response');
    await hook('charge.dispute.created', dG);
    check('a payment inquiry moves no money and does not pause the wallet; it only raises an incident', (await bal(U.g)) === 2000 && !(await frozen(U.g)) && (await dbDispute(dG.id)).status === 'inquiry' && (await incidents(U.g, 'dispute_open')).length === 1, '');
    await hook('charge.dispute.closed', { ...dG, status: 'warning_closed' });
    check('the inquiry closing returns nothing (nothing was taken) and clears the incident', (await bal(U.g)) === 2000 && (await dbDispute(dG.id)).status === 'inquiry_closed' && (await incidents(U.g, 'dispute_open'))[0].status === 'resolved', '');

    // the "created" event never arrived
    const tH = await topup(U.h, 2000);
    const dH = dispute(tH, 2000, 'lost');
    await hook('charge.dispute.closed', dH);
    check('a dispute that is closed as lost without a "created" event is still handled: taken back, recorded, lost incident, paused', (await bal(U.h)) === 0 && (await dbDispute(dH.id)).status === 'lost' && (await incidents(U.h, 'dispute_lost')).length === 1 && (await frozen(U.h)), '');

    // two disputes: un-paused only when both are won
    const tI1 = await topup(U.i, 2000), tI2 = await topup(U.i, 2000);
    const dI1 = dispute(tI1, 2000), dI2 = dispute(tI2, 2000);
    await hook('charge.dispute.created', dI1); await hook('charge.dispute.created', dI2);
    await hook('charge.dispute.closed', { ...dI1, status: 'won' });
    check('two disputes open: winning one does not un-pause the wallet', (await frozen(U.i)) && (await bal(U.i)) === 2000, `bal ${await bal(U.i)}`);
    await hook('charge.dispute.closed', { ...dI2, status: 'won' });
    check('winning the second un-pauses it and returns both amounts', !(await frozen(U.i)) && (await bal(U.i)) === 4000, `bal ${await bal(U.i)}`);

    // a dispute on a charge that is not a wallet top-up
    check('a dispute on a subscription charge is ignored by the wallet', (await hook('charge.dispute.created', { id: 'dp_sub', object: 'dispute', charge: 'ch_sub', payment_intent: 'pi_subscription_x', amount: 7900, reason: 'fraudulent', status: 'needs_response' })) === 200 && !(await pool.query("select 1 from wallet_disputes where stripe_dispute_id='dp_sub'")).rowCount, '');
    check('a live-mode event for a payment we never credited is ignored', (await hook('charge.refunded', { id: 'ch_live', object: 'charge', payment_intent: 'pi_live_nothing', amount: 2000, amount_refunded: 2000 }, true)) === 200, '');

    // ================= admin tools
    const ov = await AD.walletOverview(pool);
    check('admin overview lists the open incidents and the paused wallets (with email)', ov.incidents.some((i) => i.userId === U.e.id && i.kind === 'dispute_lost' && i.email === `${tag}_e@example.invalid`) && ov.frozen.some((f) => f.userId === U.e.id && /^dispute:/.test(f.reason ?? '')) && !ov.frozen.some((f) => f.userId === U.d.id), `${ov.incidents.length} incidents, ${ov.frozen.length} paused`);
    const det = (await AD.walletDetail(pool, U.e.id))!;
    check('admin detail shows the dispute, the top-up with its refunds, and the incidents', det.frozen.frozen && det.disputes[0]?.status === 'lost' && det.topups[0]?.cents === 2000 && det.incidents.some((i) => i.kind === 'dispute_lost'), JSON.stringify({ f: det.frozen.frozen, d: det.disputes.length }));
    const detA = (await AD.walletDetail(pool, U.a.id))!;
    check('admin detail shows a refunded top-up', detA.topups[0]?.refundedCents === 5000, JSON.stringify(detA.topups[0]));

    check('un-pause needs a note', !(await D.adminUnfreeze(pool, { userId: U.e.id, adminId: null, note: ' ' })).ok && (await frozen(U.e)), '');
    check('un-pausing a wallet that is not paused says so', !(await D.adminUnfreeze(pool, { userId: U.a.id, adminId: null, note: 'checking' })).ok, '');
    const un = await D.adminUnfreeze(pool, { userId: U.e.id, adminId: null, note: 'Customer confirmed and paid the difference' });
    check('un-pause with a note works and leaves an audit row', un.ok && !(await frozen(U.e)) && (await incidents(U.e, 'manual')).some((i) => /unpaused by admin/i.test(i.note) && /Customer confirmed/.test(i.note)), JSON.stringify(un));
    const lostId = lostInc[0].id;
    check('closing an incident needs a note, then works once', !(await D.adminResolveIncident(pool, { incidentId: lostId, adminId: null, note: '' })).ok && (await D.adminResolveIncident(pool, { incidentId: lostId, adminId: null, note: 'Written off' })).ok && !(await D.adminResolveIncident(pool, { incidentId: lostId, adminId: null, note: 'again' })).ok, '');

    const tok = (n: string) => `tok_${tag}_${n}`.slice(0, 40);
    const adj = (u: { id: number }, cents: number, reason: string, token: string) => D.adminAdjust(pool, { userId: u.id, cents, adminId: null, reason, token });
    const balJ0 = await bal(U.j);
    let r = await adj(U.j, 500, 'Goodwill credit', tok('1'));
    check('adjustment: add $5.00 with a reason -> balance +$5.00, one ledger row the customer can read, one audit row', r.ok && (await bal(U.j)) === balJ0 + 500 && (await ledger(U.j)).some((l) => l.kind === 'adjustment' && l.amount_cents === '500' && /Goodwill credit/.test(l.description)) && (await incidents(U.j, 'manual')).length === 1, JSON.stringify(r));
    r = await adj(U.j, 500, 'Goodwill credit', tok('1'));
    check('the same click twice (same token) adds once', r.ok && (await bal(U.j)) === balJ0 + 500 && (await incidents(U.j, 'manual')).length === 1, JSON.stringify(r));
    r = await adj(U.j, -200, 'Correction', tok('2'));
    check('adjustment: remove $2.00 -> balance $3.00 less', r.ok && (await bal(U.j)) === balJ0 + 300, JSON.stringify(r));
    r = await adj(U.j, -999999, 'Too much', tok('3'));
    check('removing more than the wallet has is refused, nothing changes', !r.ok && (await bal(U.j)) === balJ0 + 300, JSON.stringify(r));
    check('over $1,000 in one go is refused (add and remove)', !(await adj(U.j, 100001, 'Big', tok('4'))).ok && !(await adj(U.j, -100001, 'Big', tok('5'))).ok, '');
    check('a missing or short reason, zero, fractions and a bad token are refused', !(await adj(U.j, 100, '', tok('6'))).ok && !(await adj(U.j, 100, 'ab', tok('6'))).ok && !(await adj(U.j, 0, 'Zero', tok('6'))).ok && !(await adj(U.j, 1.5, 'Half', tok('6'))).ok && !(await adj(U.j, 100, 'Reason', 'x')).ok && (await bal(U.j)) === balJ0 + 300, '');
    check('an unknown account is refused', !(await D.adminAdjust(pool, { userId: 999999999, cents: 100, adminId: null, reason: 'Nobody', token: tok('7') })).ok, '');
    const hj: any = await Cg.reserveForService(pool, { userId: U.j.id, item: 'property_data', idempotencyKey: `${tag}:jh` }); // $1.00 set aside
    const rj = await adj(U.j, -(balJ0 + 300), 'Take everything', tok('8'));
    check('an admin cannot remove money that is set aside for a service in progress', !rj.ok && (await bal(U.j)) === balJ0 + 300 && (await held(U.j)) === 100, JSON.stringify(rj));
    await Cg.releaseHold(pool, hj.holdId);
    await L.inTx(pool, (c) => L.freezeAccount(c, U.j.id, 'test'));
    check('an admin can add and remove money on a paused wallet (frozen does not block admin changes)', (await adj(U.j, 100, 'While paused', tok('9'))).ok && (await adj(U.j, -50, 'While paused', tok('10'))).ok && (await bal(U.j)) === balJ0 + 350, String(await bal(U.j)));
    await L.inTx(pool, (c) => L.unfreezeAccount(c, U.j.id));

    // ================= the admin actions are gated
    delete process.env.TEST_CLERK_ID;
    const A = await import('../../app/admin/wallets/actions');
    const refused = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };
    check('admin write actions refuse when nobody is signed in as an admin (un-pause, close incident, adjust)', (await refused(() => A.unfreezeWallet(U.e.id, 'x'))) && (await refused(() => A.resolveWalletIncident(1, 'x'))) && (await refused(() => A.adjustWalletBalance(U.j.id, 'add', '5.00', 'reason here', tok('11')))) && (await bal(U.j)) === balJ0 + 350, '');
  } finally {
    await cleanup();
  }
  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
