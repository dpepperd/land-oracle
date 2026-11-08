// Sends svix-signed Clerk events to the REAL route handler and checks the users table (temporary rows, cleaned up).
//   npx tsx --require ./scripts/stripe/next-stub.cjs scripts/launch/clerk-webhook-sim.ts
import path from 'path'; import dotenv from 'dotenv'; import { Webhook } from 'svix';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
process.env.CLERK_WEBHOOK_SECRET = 'whsec_' + Buffer.from('clerk-sim-secret-0123456789abcdef').toString('base64');
process.env.ADMIN_EMAILS = 'sim-admin@example.invalid';
let pass = 0, fail = 0; const check = (n: string, ok: boolean, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); };
(async () => {
  const { default: pool } = await import('../../lib/db');
  const { POST } = await import('../../app/api/webhooks/clerk/route');
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const stamp = Date.now();
  const send = async (type: string, data: any, bad = false) => {
    const payload = JSON.stringify({ type, data, object: 'event' }); const id = `msg_sim_${stamp}_${Math.random().toString(36).slice(2)}`; const ts = new Date();
    const sig = bad ? 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' : wh.sign(id, ts, payload);
    (globalThis as any).__reqHeaders = { 'svix-id': id, 'svix-timestamp': String(Math.floor(ts.getTime() / 1000)), 'svix-signature': sig };
    const r = await POST(new Request('http://x/api/webhooks/clerk', { method: 'POST', body: payload }));
    return r.status;
  };
  const u = (cid: string) => pool.query('select role, subscription_tier t, email from users where clerk_id=$1', [cid]).then((r) => r.rows[0]);
  const mk = (id: string, email: string, verified = true, meta: any = {}) => ({ id, email_addresses: [{ id: 'idn_1', email_address: email, verification: { status: verified ? 'verified' : 'unverified' } }], primary_email_address_id: 'idn_1', public_metadata: meta });
  const ids = [`user_sim_a_${stamp}`, `user_sim_b_${stamp}`, `user_sim_c_${stamp}`, `user_sim_d_${stamp}`];
  try {
    check('user.created -> 200', (await send('user.created', mk(ids[0], `${ids[0]}@example.invalid`))) === 200);
    let r = await u(ids[0]); check('row created as role=user, tier demo(=free)', r && r.role === 'user' && r.t === 'demo', JSON.stringify(r));
    check('duplicate user.created is idempotent', (await send('user.created', mk(ids[0], `${ids[0]}@example.invalid`))) === 200 && (await pool.query('select count(*)::int n from users where clerk_id=$1', [ids[0]])).rows[0].n === 1);
    await send('user.created', mk(ids[1], 'sim-admin@example.invalid', true));
    check('verified ADMIN_EMAILS address -> admin', (await u(ids[1]))?.role === 'admin');
    await send('user.created', mk(ids[2], 'sim-admin@example.invalid', false));
    check('UNVERIFIED admin email -> NOT admin', (await u(ids[2]))?.role === 'user');
    await send('user.created', mk(ids[3], `${ids[3]}@example.invalid`, true, { role: 'admin' }));
    check('publicMetadata.role=admin -> admin', (await u(ids[3]))?.role === 'admin');
    await send('user.updated', mk(ids[0], `changed_${ids[0]}@example.invalid`));
    check('user.updated syncs email', (await u(ids[0]))?.email?.startsWith('changed_'));
    check('bad signature -> 400', (await send('user.created', mk(`user_sim_bad_${stamp}`, 'x@example.invalid'), true)) === 400 && !(await u(`user_sim_bad_${stamp}`)));
    await send('user.deleted', { id: ids[0] });
    check('user.deleted removes the row', !(await u(ids[0])));
  } finally {
    await pool.query("delete from users where clerk_id like 'user_sim_%'"); await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
