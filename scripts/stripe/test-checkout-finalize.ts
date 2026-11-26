// Offline test of finishing a paid checkout without the webhook. Fake Stripe lookups, real DB, temporary user cleaned up.
//   npx tsx scripts/stripe/test-checkout-finalize.ts
import path from 'path'; import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

const T = Date.now();
const CLERK = `fin_clerk_${T}`, OTHER = `fin_other_${T}`, CUS = `cus_fin_${T}`, SUB = `sub_fin_${T}`, SES = `cs_test_fin${T}`;
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const sub = (status = 'active', key = 'scout_monthly') => ({
  id: SUB, object: 'subscription', customer: CUS, status, cancel_at_period_end: false, metadata: { userId: CLERK },
  items: { object: 'list', data: [{ id: 'si_1', quantity: 1, price: { id: 'price_1', lookup_key: key }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
}) as any;
const session = (over: any = {}) => ({ id: SES, object: 'checkout.session', mode: 'subscription', status: 'complete', payment_status: 'paid', customer: CUS, subscription: SUB, client_reference_id: CLERK, metadata: { userId: CLERK }, ...over }) as any;
const stripeWith = (s: any, b: any = sub()) => ({ getSession: async () => s, getSubscription: async () => b });

(async () => {
  const { default: pool } = await import('../../lib/db');
  const { finalizeCheckout } = await import('../../lib/checkout-finalize');
  const row = async (id = CLERK) => (await pool.query('SELECT subscription_tier t, subscription_status s, beta_access b, stripe_customer_id c, stripe_subscription_id sid FROM users WHERE clerk_id = $1', [id])).rows[0];

  await pool.query("INSERT INTO users (clerk_id, email, subscription_tier, subscription_status, role) VALUES ($1,$2,'demo','active','user'), ($3,$4,'demo','active','user')", [CLERK, `${CLERK}@example.invalid`, OTHER, `${OTHER}@example.invalid`]);
  try {
    let u = await row();
    check('new signup starts locked out (beta_access false)', u.b === false);

    let r = await finalizeCheckout(pool, stripeWith(session()), 'bad id!', CLERK);
    check('malformed session id is refused', r.status === 'invalid');

    r = await finalizeCheckout(pool, stripeWith(session()), SES, OTHER);
    u = await row(OTHER);
    check('another account cannot finish this session; their row stays locked', r.status === 'invalid' && u.b === false && u.t === 'demo', r.detail);

    r = await finalizeCheckout(pool, stripeWith(session({ mode: 'payment' })), SES, CLERK);
    check('non-subscription session is refused', r.status === 'invalid');

    for (const over of [{ status: 'open' }, { payment_status: 'unpaid' }, { subscription: null }]) {
      r = await finalizeCheckout(pool, stripeWith(session(over)), SES, CLERK);
      u = await row();
      check(`unfinished session ${JSON.stringify(over)} => pending, still locked`, r.status === 'pending' && u.b === false, r.detail);
    }

    r = await finalizeCheckout(pool, { getSession: async () => { throw new Error('stripe down'); }, getSubscription: async () => sub() }, SES, CLERK);
    check('Stripe error => error status, no change', r.status === 'error' && (await row()).b === false);

    r = await finalizeCheckout(pool, stripeWith(session()), SES, CLERK);
    u = await row();
    check('paid session unlocks the account (tier, status, beta_access, customer and subscription ids)', r.status === 'synced' && u.b === true && u.t === 'scout' && u.s === 'active' && u.c === CUS && u.sid === SUB, JSON.stringify(u));

    r = await finalizeCheckout(pool, stripeWith(session(), sub('active', 'pro_annual')), SES, CLERK);
    u = await row();
    check('running it again (webhook already did the work) is safe and reflects the subscription', r.status === 'synced' && u.t === 'pro' && u.b === true);

    // user row missing (Clerk webhook not delivered): must not crash and must not claim success
    r = await finalizeCheckout(pool, stripeWith(session({ client_reference_id: `ghost_${T}`, metadata: { userId: `ghost_${T}` }, customer: `cus_ghost_${T}` }), { ...sub(), customer: `cus_ghost_${T}`, metadata: { userId: `ghost_${T}` } }), SES, `ghost_${T}`);
    check('no user row yet => pending (waits for the Clerk webhook)', r.status === 'pending', r.detail);
  } finally {
    await pool.query('DELETE FROM users WHERE clerk_id = ANY($1)', [[CLERK, OTHER]]);
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? 'ALL PASS' : 'FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
