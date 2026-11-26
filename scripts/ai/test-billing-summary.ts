// The post-checkout banner's data: pure shaping checks, then the real /api/billing/summary handler (dev DB, stubbed sign-in,
// temporary user cleaned up afterwards).
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-billing-summary.ts
import path from 'path'; import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { buildBillingSummary } from '../../lib/billing-summary';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const row = (o: any = {}) => ({ subscription_tier: 'scout', subscription_status: 'active', plan_interval: 'month', county_allowance: 1, current_period_end: '2026-12-26T16:16:00.000Z', cancel_at_period_end: false, email: 'a@example.invalid', ...o });

(async () => {
  let s = buildBillingSummary(row(), ['Clay']);
  check('scout monthly: active, plan name, interval, renewal date, 1 county, 1000 exports, no AI', s.active && s.plan?.name === 'Scout' && s.interval === 'month' && s.renewsOn === '2026-12-26T16:16:00.000Z' && s.allowance === 1 && s.exportsPerMonth === 1000 && s.aiAnalyst === false);
  s = buildBillingSummary(row({ subscription_tier: 'pro', plan_interval: 'year', county_allowance: 5 }), []);
  check('pro yearly with 2 add-on counties: allowance 5, unlimited exports, AI included', s.active && s.interval === 'year' && s.allowance === 5 && s.exportsPerMonth === 'unlimited' && s.aiAnalyst === true);
  s = buildBillingSummary(row({ subscription_tier: 'statewide', county_allowance: 67 }), 'all');
  check('statewide: allowance null, counties all', s.active && s.allowance === null && s.counties === 'all');
  for (const st of ['active', 'trialing', 'past_due']) check(`status ${st} counts as active`, buildBillingSummary(row({ subscription_status: st }), []).active === true);
  for (const st of ['canceled', 'unpaid', 'incomplete', null]) check(`status ${st} is not active`, buildBillingSummary(row({ subscription_status: st }), []).active === false);
  for (const t of ['free', 'demo', 'trial', null]) check(`tier ${t} is not a paid plan`, buildBillingSummary(row({ subscription_tier: t }), []).active === false);
  check('no price field is exposed (coupons change what was charged)', !JSON.stringify(buildBillingSummary(row(), [])).match(/price|amount|cents/i));
  check('missing renewal date is null, not a crash', buildBillingSummary(row({ current_period_end: null }), []).renewsOn === null);

  // ---- real route
  const { default: pool } = await import('../../lib/db');
  const CLERK = `sum_clerk_${Date.now()}`;
  await pool.query("INSERT INTO users (clerk_id, email, subscription_tier, subscription_status, role, plan_interval, county_allowance, current_period_end) VALUES ($1,$2,'scout','active','user','month',1, now() + interval '30 days')", [CLERK, `${CLERK}@example.invalid`]);
  try {
    const route = await import('../../app/api/billing/summary/route');
    delete process.env.TEST_CLERK_ID;
    let res = await route.GET();
    check('signed out => 401', res.status === 401);
    process.env.TEST_CLERK_ID = CLERK;
    res = await route.GET();
    const j: any = await res.json();
    check('signed in => 200 with the user\'s own plan', res.status === 200 && j.active === true && j.plan?.id === 'scout' && j.email === `${CLERK}@example.invalid`, JSON.stringify(j));
    check('response carries no Stripe ids', !JSON.stringify(j).match(/cus_|sub_|stripe/i));
    await pool.query("UPDATE users SET subscription_tier='free', subscription_status='active' WHERE clerk_id=$1", [CLERK]);
    j.active = (await (await route.GET()).json()).active;
    check('a free account reports not active', j.active === false);
    process.env.TEST_CLERK_ID = `ghost_${Date.now()}`;
    check('unknown account => 404', (await route.GET()).status === 404);
  } finally {
    await pool.query('DELETE FROM users WHERE clerk_id = $1', [CLERK]);
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? 'ALL PASS' : 'FAILURES');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
