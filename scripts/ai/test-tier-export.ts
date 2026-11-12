// Runs the REAL POST handler of /api/parcels/export (dev DB, stubbed sign-in) for each plan tier, plus the dashboard's tier mapping.
// A dev test user is switched through the tiers and restored afterwards. Usage:
//   npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-tier-export.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { uiTier } from '../../lib/tierAccess';

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  // ---- dashboard tier mapping (pure)
  for (const [role, tier, want] of [
    ['user', 'pro', 'paid'], ['user', 'scout', 'paid'], ['user', 'statewide', 'paid'], ['user', 'enterprise', 'paid'], ['admin', 'free', 'paid'],
    ['user', 'free', 'demo'], ['user', 'demo', 'demo'], ['user', 'trial', 'demo'], ['user', 'local', 'demo'], ['user', 'regional', 'demo'], ['user', undefined, 'demo'],
  ] as const) check(`uiTier(${role}, ${tier}) = ${want}`, uiTier(role, tier as any) === want, uiTier(role, tier as any));

  // ---- real export handler per tier
  const { default: pool } = await import('../../lib/db');
  const user = (await pool.query("select id, clerk_id, subscription_tier, subscription_status, county_allowance from users u where coalesce(role,'user')<>'admin' and clerk_id is not null and exists (select 1 from user_county_access c where c.user_id=u.id) order by id limit 1")).rows[0];
  const orig = { tier: user.subscription_tier, status: user.subscription_status, allowance: user.county_allowance };
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const usage0 = (await pool.query('select rows from export_usage where user_id=$1 and month=$2', [user.id, month])).rows[0]?.rows ?? null;
  process.env.TEST_CLERK_ID = user.clerk_id;
  const route = await import('../../app/api/parcels/export/route');
  const { getEntitlements } = await import('../../lib/entitlements');

  const setTier = async (tier: string) => {
    await pool.query("update users set subscription_tier=$2, subscription_status='active', county_allowance=3 where id=$1", [user.id, tier]);
    await pool.query('delete from export_usage where user_id=$1 and month=$2', [user.id, month]);
  };
  const callExport = async (county: string) => {
    const res = await route.POST(new Request('http://localhost/api/parcels/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ counties: [county], landUse: ['001'], limit: 5 }) }));
    const text = await res.text();
    return { status: res.status, text };
  };

  try {
    for (const tier of ['free', 'demo', 'trial']) {
      await setTier(tier);
      const ent = await getEntitlements(user.clerk_id);
      const r = await callExport(Array.isArray(ent.counties) ? ent.counties[0] : 'Clay');
      check(`${tier}: export refused (402 export_not_included)`, r.status === 402 && r.text.includes('export_not_included'), `status ${r.status} ${r.text.slice(0, 90)}`);
    }
    for (const tier of ['scout', 'pro', 'statewide']) {
      await setTier(tier);
      const ent = await getEntitlements(user.clerk_id);
      const county = Array.isArray(ent.counties) ? ent.counties[0] : 'Clay';
      const r = await callExport(county);
      const rows = r.text ? r.text.split('\n').length - 1 : 0;
      check(`${tier}: export allowed (200 CSV with rows)`, r.status === 200 && rows > 0, `status ${r.status}, ${rows} rows, county ${county}, limit ${ent.exports.limit}`);
    }
    // scout cap still enforced
    await setTier('scout');
    const ent = await getEntitlements(user.clerk_id);
    await pool.query('insert into export_usage (user_id, month, rows) values ($1,$2,$3) on conflict (user_id, month) do update set rows=$3', [user.id, month, ent.exports.limit]);
    const r = await callExport(Array.isArray(ent.counties) ? ent.counties[0] : 'Clay');
    check('scout at 1,000 rows: refused with export_cap_reached', r.status === 402 && r.text.includes('export_cap_reached'), `status ${r.status} ${r.text.slice(0, 80)}`);

    // AI-results CSV route: same free/paid rules
    const aiRoute = await import('../../app/api/assistant/export/route');
    const aiKey = (await pool.query("select parcel_key from parcels_current_all where county='Clay' and has_geom limit 1")).rows[0].parcel_key;
    const callAi = async () => { const res = await aiRoute.POST(new Request('http://localhost/api/assistant/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys: [aiKey] }) })); return { status: res.status, text: await res.text() }; };
    for (const tier of ['free', 'demo', 'trial']) {
      await setTier(tier);
      const ar = await callAi();
      check(`AI export, ${tier}: refused (402 export_not_included)`, ar.status === 402 && ar.text.includes('export_not_included'), `status ${ar.status}`);
    }
    for (const tier of ['scout', 'pro', 'statewide']) {
      await setTier(tier);
      const ar = await callAi();
      check(`AI export, ${tier}: allowed (200, 1 row)`, ar.status === 200 && ar.text.split('\n').length === 2, `status ${ar.status}, lines ${ar.text.split('\n').length}`);
    }
  } finally {
    await pool.query('update users set subscription_tier=$2, subscription_status=$3, county_allowance=$4 where id=$1', [user.id, orig.tier, orig.status, orig.allowance]);
    if (usage0 === null) await pool.query('delete from export_usage where user_id=$1 and month=$2', [user.id, month]);
    else await pool.query('insert into export_usage (user_id, month, rows) values ($1,$2,$3) on conflict (user_id, month) do update set rows=$3', [user.id, month, usage0]);
    const back = (await pool.query('select subscription_tier, subscription_status, county_allowance from users where id=$1', [user.id])).rows[0];
    results.push(`RESTORED  user ${user.id}: tier ${back.subscription_tier}, status ${back.subscription_status}, allowance ${back.county_allowance} (was ${orig.tier}/${orig.status}/${orig.allowance})`);
  }
  console.log(results.join('\n'));
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('CRASHED', e); process.exit(2); });
