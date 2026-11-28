// Admin view of customer wallets (lib/wallet/admin.ts): totals, the "needs a person" list, search, one account's history, and the admin gate on the actions.
// Real code on the DEV database (public schema; applies migrations 017, 018, 020 there, all idempotent). Throwaway users, removed afterwards (their wallets cascade).
// Totals are compared as before/after DIFFERENCES because the dev database already holds other wallets. Never touches app_prod.
// Usage: npx tsx --require ./scripts/ai/clerk-stub-auth.cjs scripts/ai/test-wallet-admin.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

(async () => {
  const { default: pool } = await import('../../lib/db');
  for (const f of ['017_wallet.sql', '018_postcard_sizes.sql', '020_wallet_holds.sql']) await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8'));
  const L = await import('../../lib/wallet/ledger');
  const Cg = await import('../../lib/wallet/charge');
  const S = await import('../../lib/wallet/settings');
  const AD = await import('../../lib/wallet/admin');

  const orig = (await pool.query("select key, value from app_settings where key = 'wallet_prices'")).rows;
  if (!orig.length) { console.log('FAIL  dev database has no wallet_prices row (run the wallet tests first)'); process.exit(1); }
  const base: any = await S.getPrices(pool);
  await S.setPrices(pool, { ...base, skip_trace: { cents: 15, enabled: true }, skip_trace_dnc: { cents: 5, enabled: true } }, null);

  const tag = 'test_walletadmin_' + Date.now();
  const mk = async (n: string) => (await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id", [`${tag}_${n}`, `${tag}_${n}@example.invalid`])).rows[0].id as number;
  const u1 = await mk('a'), u2 = await mk('b'), u3 = await mk('c');
  const users = [u1, u2, u3];
  let k = 0;
  const topup = (id: number, cents: number) => L.inTx(pool, (c) => L.credit(c, { userId: id, cents, kind: 'topup', idempotencyKey: `${tag}:t${++k}` }));
  const cleanup = async () => {
    await pool.query('delete from users where id = any($1::int[])', [users]);
    await pool.query("delete from app_settings where key='wallet_prices'");
    for (const r of orig) await pool.query('insert into app_settings (key, value) values ($1,$2::jsonb)', [r.key, JSON.stringify(r.value)]);
  };

  try {
    const before = await AD.walletOverview(pool);
    const item = (o: any, name: string) => o.byItem30d.find((x: any) => x.item === name) ?? { count: 0, cents: 0 };

    // u1: $50 top-up, one skip trace ($0.15) and its DNC add-on ($0.05), each as a hold settled into a charge
    await topup(u1, 5000);
    const h1: any = await Cg.reserveForService(pool, { userId: u1, item: 'skip_trace', idempotencyKey: `${tag}:h1`, ref: 'owner aaaa1111' });
    await Cg.settleHold(pool, h1.holdId);
    const h2: any = await Cg.reserveForService(pool, { userId: u1, item: 'skip_trace_dnc', idempotencyKey: `${tag}:h2`, ref: 'owner aaaa1111' });
    await Cg.settleHold(pool, h2.holdId);
    // u2: $20 top-up and a direct postcard charge of $1.15
    await topup(u2, 2000);
    await L.inTx(pool, (c) => L.debit(c, { userId: u2, cents: 115, kind: 'charge', item: 'postcard_4x6', idempotencyKey: `${tag}:pc` }));
    // u3: $10 top-up; one hold that needs a person ($0.15, never expires), one in progress ($0.15), one expired but still open ($0.15)
    await topup(u3, 1000);
    const need: any = await Cg.reserveForService(pool, { userId: u3, item: 'skip_trace', idempotencyKey: `${tag}:need` });
    await L.inTx(pool, (c) => L.keepHold(c, need.holdId, 'lookup delivered, settle failed: needs attention'));
    await Cg.reserveForService(pool, { userId: u3, item: 'skip_trace', idempotencyKey: `${tag}:live` });
    const exp: any = await Cg.reserveForService(pool, { userId: u3, item: 'skip_trace', idempotencyKey: `${tag}:exp` });
    await pool.query("update wallet_holds set expires_at = now() - interval '5 minutes' where id=$1", [exp.holdId]);

    const after = await AD.walletOverview(pool);
    check('overview: three more wallets', after.wallets - before.wallets === 3, `${before.wallets} -> ${after.wallets}`);
    check('overview: customer money = $50 - $0.20 + $20 - $1.15 + $10 = $78.65 more', after.balanceCents - before.balanceCents === 5000 - 20 + 2000 - 115 + 1000, String(after.balanceCents - before.balanceCents));
    check('overview: held = three $0.15 holds = $0.45 more', after.heldCents - before.heldCents === 45, String(after.heldCents - before.heldCents));
    check('overview: top-ups last 30 days = $80.00 more', after.topups30dCents - before.topups30dCents === 8000, String(after.topups30dCents - before.topups30dCents));
    check('overview: spending last 30 days = $0.20 + $1.15 = $1.35 more', after.spend30dCents - before.spend30dCents === 135, String(after.spend30dCents - before.spend30dCents));
    check('overview: by service, skip trace +1 use $0.15, the DNC check +1 use $0.05, postcard 4x6 +1 use $1.15', item(after, 'skip_trace').count - item(before, 'skip_trace').count === 1 && item(after, 'skip_trace').cents - item(before, 'skip_trace').cents === 15 && item(after, 'skip_trace_dnc').cents - item(before, 'skip_trace_dnc').cents === 5 && item(after, 'postcard_4x6').cents - item(before, 'postcard_4x6').cents === 115, JSON.stringify(after.byItem30d));
    const mine = after.needsAttention.filter((x) => x.userId === u3);
    check('"needs a person": exactly the never-expiring hold, with the account email, item, amount and note', mine.length === 1 && mine[0].holdId === need.holdId && mine[0].cents === 15 && mine[0].item === 'skip_trace' && mine[0].email === `${tag}_c@example.invalid` && /needs attention/.test(mine[0].note ?? ''), JSON.stringify(mine));
    check('the in-progress hold is NOT in the "needs a person" list', !after.needsAttention.some((x) => x.userId === u3 && x.holdId !== need.holdId), '');
    check('expired open holds are counted separately (one more, $0.15)', after.expiredOpen.count - before.expiredOpen.count === 1 && after.expiredOpen.cents - before.expiredOpen.cents === 15, JSON.stringify(after.expiredOpen));

    const list = await AD.listWallets(pool, { q: tag });
    const byId = (id: number) => list.find((r) => r.userId === id);
    check('search by email finds exactly the three test accounts', list.length === 3 && users.every((id) => byId(id)), `${list.length}`);
    check('row u1: balance $49.80, nothing held, topped up $50.00, spent $0.20', byId(u1)?.balanceCents === 4980 && byId(u1)?.heldCents === 0 && byId(u1)?.topupCents === 5000 && byId(u1)?.spentCents === 20, JSON.stringify(byId(u1)));
    check('row u2: balance $18.85, topped up $20.00, spent $1.15', byId(u2)?.balanceCents === 1885 && byId(u2)?.topupCents === 2000 && byId(u2)?.spentCents === 115, JSON.stringify(byId(u2)));
    check('row u3: balance $10.00, held $0.45, nothing spent', byId(u3)?.balanceCents === 1000 && byId(u3)?.heldCents === 45 && byId(u3)?.spentCents === 0, JSON.stringify(byId(u3)));
    check('rows carry the email, plan and a last-activity time', list.every((r) => r.email?.startsWith(tag) && r.tier === 'scout' && !!r.lastActivity), '');
    check('wildcards typed in the search are taken literally (% and _ find nothing here)', (await AD.listWallets(pool, { q: '%%' })).filter((r) => users.includes(r.userId)).length === 0 && (await AD.listWallets(pool, { q: tag.slice(0, -3) + '___' })).length === 0, '');
    check('a search of one character is ignored (lists wallets, no error); the limit is capped', (await AD.listWallets(pool, { q: 'x', limit: 5 })).length <= 5 && (await AD.listWallets(pool, { limit: 99999 })).length <= 200, '');
    check('paging: offset skips rows', (await AD.listWallets(pool, { q: tag, limit: 2, offset: 2 })).length === 1, '');

    const d1 = (await AD.walletDetail(pool, u1))!;
    check('detail u1: balance, spendable, totals', d1.balanceCents === 4980 && d1.heldCents === 0 && d1.spendableCents === 4980 && d1.topupCents === 5000 && d1.spentCents === 20, JSON.stringify({ b: d1.balanceCents, t: d1.topupCents, s: d1.spentCents }));
    check('detail u1: spend by service lists contact and the DNC check separately', d1.spendByItem.length === 2 && d1.spendByItem.some((s) => s.item === 'skip_trace' && s.cents === 15) && d1.spendByItem.some((s) => s.item === 'skip_trace_dnc' && s.cents === 5), JSON.stringify(d1.spendByItem));
    check('detail u1: ledger newest first with the references (3 rows)', d1.ledger.length === 3 && d1.ledger[0].item === 'skip_trace_dnc' && d1.ledger[0].amountCents === -5 && d1.ledger[0].ref === 'owner aaaa1111' && d1.ledger[2].kind === 'topup', JSON.stringify(d1.ledger.map((l) => l.kind + ':' + l.amountCents)));
    check('detail u1: both holds shown as settled', d1.holds.length === 2 && d1.holds.every((h) => h.status === 'settled'), JSON.stringify(d1.holds.map((h) => h.status)));
    const d3 = (await AD.walletDetail(pool, u3))!;
    check('detail u3: spendable = balance - held ($9.55), holds show held and the "needs attention" note', d3.spendableCents === 955 && d3.holds.filter((h) => h.status === 'held').length === 3 && d3.holds.some((h) => h.expiresAt === null && /needs attention/.test(h.note ?? '')), JSON.stringify(d3.holds.map((h) => h.status)));
    check('detail: unknown account, zero and a non-integer id give null (no crash)', (await AD.walletDetail(pool, 999999999)) === null && (await AD.walletDetail(pool, 0)) === null && (await AD.walletDetail(pool, 1.5)) === null && (await AD.walletDetail(pool, NaN)) === null, '');
    const noWallet = await pool.query("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id", [`${tag}_d`, `${tag}_d@example.invalid`]);
    users.push(noWallet.rows[0].id);
    const dn = (await AD.walletDetail(pool, noWallet.rows[0].id))!;
    check('an account that never had a wallet shows zeros and empty history', dn.balanceCents === 0 && dn.ledger.length === 0 && dn.holds.length === 0, '');

    // ---- the admin gate on the actions: with no signed-in admin they refuse (redirect) and hand back no data
    delete process.env.TEST_CLERK_ID;
    const A = await import('../../app/admin/wallets/actions');
    const refused = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };
    check('admin actions refuse when nobody is signed in as an admin (overview, list, detail)', (await refused(() => A.loadWalletOverview())) && (await refused(() => A.loadWalletList('', 0))) && (await refused(() => A.loadWalletDetail(u1))), '');
  } finally {
    await cleanup().catch((e) => console.log('cleanup problem:', e.message));
  }
  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  await pool.end();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
