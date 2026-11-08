// Offline billing simulation: signed, real-shaped Stripe events -> the REAL webhook route -> real DB (temporary test user, cleaned up).
// Does NOT call Stripe. It proves our entitlement logic; the live Stripe test-mode run still needs STRIPE_SECRET_KEY.
//   npx tsx --require ./scripts/stripe/next-stub.cjs scripts/stripe/webhook-sim.ts
import path from 'path'; import dotenv from 'dotenv'; import Stripe from 'stripe';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_simulation_only';

const CLERK = `sim_clerk_${Date.now()}`, CUS = `cus_sim_${Date.now()}`, SUB = `sub_sim_${Date.now()}`;
let evSeq = 0, pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

function item(key: string, qty = 1) { return { id: `si_${key}`, quantity: qty, price: { id: `price_${key}`, lookup_key: key }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }; }
function sub(status: string, items: any[], extra: any = {}) {
  return { id: SUB, object: 'subscription', customer: CUS, status, cancel_at_period_end: false, metadata: { userId: CLERK }, items: { object: 'list', data: items }, ...extra };
}

(async () => {
  const stripe = new Stripe('sk_test_sim_not_used');
  const { default: pool } = await import('../../lib/db');
  const { POST } = await import('../../app/api/webhooks/stripe/route');
  const ent = await import('../../lib/entitlements');

  const send = async (type: string, object: any, opts: { id?: string; badSig?: boolean } = {}) => {
    const id = opts.id ?? `evt_sim_${Date.now()}_${evSeq++}`;
    const payload = JSON.stringify({ id, object: 'event', type, data: { object }, api_version: '2025-12-15.clover', created: Math.floor(Date.now() / 1000), livemode: false });
    const secret = opts.badSig ? 'whsec_wrong' : process.env.STRIPE_WEBHOOK_SECRET!;
    (globalThis as any).__reqHeaders = { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret }) };
    const res = await POST(new Request('http://x/api/webhooks/stripe', { method: 'POST', body: payload }));
    return { status: res.status, body: await res.text(), id };
  };
  const row = async () => (await pool.query('SELECT id, subscription_tier t, subscription_status s, county_allowance a, needs_county_repick r, plan_interval i, cancel_at_period_end c, beta_access b FROM users WHERE clerk_id = $1', [CLERK])).rows[0];
  const setCounties = async (names: string[]) => { const u = await row(); await pool.query('DELETE FROM user_county_access WHERE user_id = $1', [u.id]); for (const n of names) { await pool.query('INSERT INTO user_county_access (user_id, county, created_at) VALUES ($1,$2, now() + ($3 || \' seconds\')::interval)', [u.id, n, String(names.indexOf(n))]); } };
  const counties = async () => { const e = await ent.getEntitlements(CLERK); return e.counties === 'all' ? 'all' : e.counties.join(','); };

  await pool.query("INSERT INTO users (clerk_id, email, subscription_tier, role, stripe_customer_id) VALUES ($1, $2, 'free', 'user', $3)", [CLERK, `${CLERK}@example.invalid`, CUS]);
  try {
    // --- every tier, monthly + annual ---
    for (const [plan, allow] of [['scout', 1], ['pro', 3], ['statewide', 67]] as const) {
      for (const iv of ['monthly', 'annual'] as const) {
        const r = await send('customer.subscription.updated', sub('active', [item(`${plan}_${iv}`)]));
        const u = await row();
        check(`subscribe ${plan} ${iv}`, r.status === 200 && u.t === plan && u.a === allow && u.i === (iv === 'monthly' ? 'month' : 'year') && u.s === 'active' && u.b === true, `tier=${u.t} allowance=${u.a} interval=${u.i}`);
      }
    }
    const e0 = await ent.getEntitlements(CLERK);
    check('statewide => counties all, unlimited exports', e0.counties === 'all' && e0.exports.limit === 'unlimited');

    // --- scout + 2 add-on counties ---
    await send('customer.subscription.updated', sub('active', [item('scout_monthly'), item('addon_county_monthly', 2)]));
    let u = await row();
    check('scout + 2 add-on counties => allowance 3', u.t === 'scout' && u.a === 3, `allowance=${u.a}`);
    await setCounties(['Clay', 'Duval', 'Nassau']);
    check('scout allowance 3 keeps 3 selected counties', (await counties()) === 'Clay,Duval,Nassau');
    check('claimCounty beyond allowance is refused', (await ent.claimCounty(CLERK, 'Polk')).ok === false);

    // --- FOUNDING40 coupon (discount object present; entitlements unchanged) ---
    await send('customer.subscription.updated', sub('active', [item('pro_annual')], { discount: { coupon: { id: 'FOUNDING40', percent_off: 40, duration: 'forever' } } }));
    u = await row();
    check('FOUNDING40-discounted pro subscription syncs normally', u.t === 'pro' && u.a === 3 && u.i === 'year');

    // --- upgrade scout -> pro ---
    await send('customer.subscription.updated', sub('active', [item('scout_monthly')]));
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')]));
    u = await row();
    check('upgrade scout -> pro', u.t === 'pro' && u.a === 3 && u.r === false, `tier=${u.t} allowance=${u.a}`);

    // --- downgrade pro (3 counties) -> scout: keep first 1, prompt re-pick ---
    await setCounties(['Clay', 'Duval', 'Nassau']);
    await send('customer.subscription.updated', sub('active', [item('scout_monthly')]));
    u = await row();
    check('downgrade pro -> scout keeps FIRST county, flags re-pick', u.t === 'scout' && u.a === 1 && u.r === true && (await counties()) === 'Clay', `counties=${await counties()} repick=${u.r}`);
    await ent.setCounties(CLERK, ['Duval']);
    u = await row();
    check('re-pick clears the flag and swaps county', u.r === false && (await counties()) === 'Duval');
    check('re-pick over allowance is rejected', (await ent.setCounties(CLERK, ['Clay', 'Duval'])).ok === false);

    // --- failed payment: access kept while past_due, then revoked when Stripe gives up ---
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')]));
    await send('invoice.payment_failed', { id: 'in_sim', object: 'invoice', customer: CUS, subscription: SUB });
    u = await row();
    let e = await ent.getEntitlements(CLERK);
    check('payment_failed => status past_due, access retained during retries', u.s === 'past_due' && e.tier === 'pro', `status=${u.s} tier=${e.tier}`);
    await send('customer.subscription.updated', sub('unpaid', [item('pro_monthly')]));
    u = await row(); e = await ent.getEntitlements(CLERK);
    check('subscription unpaid => access revoked (free)', u.t === 'free' && e.tier === 'free', `tier=${u.t}`);

    // --- cancel (flag first, then deleted) ---
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')]));
    await setCounties(['Clay', 'Duval', 'Nassau']);
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')], { cancel_at_period_end: true }));
    u = await row();
    check('cancel_at_period_end keeps access and records the flag', u.t === 'pro' && u.c === true);
    await send('customer.subscription.deleted', sub('canceled', [item('pro_monthly')]));
    u = await row();
    check('subscription deleted => free tier, 1 county kept, re-pick flagged', u.t === 'free' && u.a === 1 && u.r === true && (await counties()) === 'Clay', `counties=${await counties()}`);

    // --- stale cancel must not kill a newer subscription ---
    await send('customer.subscription.updated', sub('active', [item('scout_monthly')]));
    const r2 = await send('customer.subscription.deleted', { ...sub('canceled', [item('scout_monthly')]), id: 'sub_old_stale' });
    u = await row();
    check('stale cancel of an older subscription is ignored', u.t === 'scout', `tier=${u.t}`);

    // --- webhook hygiene ---
    const dupId = `evt_sim_dup_${Date.now()}`;
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')]), { id: dupId });
    const dup = await send('customer.subscription.updated', sub('active', [item('scout_monthly')]), { id: dupId });
    u = await row();
    check('duplicate event id is ignored (idempotent)', dup.body.includes('duplicate') && u.t === 'pro');
    const bad = await send('customer.subscription.updated', sub('active', [item('statewide_monthly')]), { badSig: true });
    check('bad signature rejected (400), no change', bad.status === 400 && (await row()).t === 'pro');
    const unk = await send('customer.subscription.updated', sub('active', [item('local_monthly')]));
    check('legacy/unknown price never auto-migrates', unk.status === 200 && (await row()).t === 'pro');

    // --- export cap: scout 1,000 rows/month, 402 path; pro unlimited ---
    await send('customer.subscription.updated', sub('active', [item('scout_monthly')]));
    const t1 = await ent.trackExport(CLERK, 600);
    const t2 = await ent.trackExport(CLERK, 600);
    const t3 = await ent.trackExport(CLERK, 400);
    check('scout export cap: 600 ok, +600 refused (would exceed 1,000), +400 ok', t1.allowed && !t2.allowed && t3.allowed && t3.remaining === 0, `remaining=${t3.remaining}`);
    check('scout at cap: any further export refused', (await ent.trackExport(CLERK, 1)).allowed === false);
    await send('customer.subscription.updated', sub('active', [item('pro_monthly')]));
    const t4 = await ent.trackExport(CLERK, 50_000);
    check('pro exports are unlimited', t4.allowed && t4.remaining === 'unlimited');
  } finally {
    const u = await row();
    if (u) { await pool.query('DELETE FROM user_county_access WHERE user_id = $1', [u.id]); await pool.query('DELETE FROM users WHERE id = $1', [u.id]); }
    await pool.query("DELETE FROM stripe_events WHERE id LIKE 'evt_sim_%'");
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
