// The Clerk user.deleted cleanup, on the dev DB with a throwaway user: creates a user with leads, notes, county access, usage rows, deletes it, checks nothing is left
// and that nobody else's rows were touched. Usage: npx tsx scripts/ai/test-delete-user.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
(async () => {
  const { default: pool } = await import('../../lib/db');
  const { deleteUserAndData } = await import('../../lib/deleteUser');
  const cid = 'test_delete_' + Date.now();
  const q = (s: string, p: any[] = []) => pool.query(s, p);
  const before = {
    users: Number((await q('select count(*) n from users')).rows[0].n),
    leads: Number((await q('select count(*) n from leads')).rows[0].n),
    notes: Number((await q('select count(*) n from user_parcel_notes')).rows[0].n),
  };
  const uid = (await q("insert into users (clerk_id, email, subscription_tier, subscription_status, role) values ($1,$2,'scout','active','user') returning id", [cid, cid + '@example.invalid'])).rows[0].id;
  const pk = (await q("select parcel_key from parcels_v2 limit 1")).rows[0].parcel_key;
  await q('insert into leads (user_id, parcel_key) values ($1,$2)', [uid, pk]);
  await q('insert into user_parcel_notes (user_id, parcel_key, content) values ($1,$2,$3)', [uid, pk, 'x']);
  await q("insert into user_county_access (user_id, county) values ($1,'Clay'),($1,'Duval')", [uid]);
  await q('insert into export_usage (user_id, month, rows) values ($1, date_trunc(\'month\', now()), 5)', [uid]);
  try { await q('insert into ai_usage (user_id, month, input_tokens, output_tokens, requests) values ($1, date_trunc(\'month\', now()), 1, 1, 1)', [cid]); } catch (e: any) { check('ai_usage accepts a clerk-id key', false, e.message); }
  // the OLD behaviour (plain delete) fails because of the foreign keys:
  let oldFails = false; try { await q('delete from users where id=$1', [uid]); } catch { oldFails = true; }
  check('plain "DELETE FROM users" is blocked by leads/notes (the bug)', oldFails, String(oldFails));
  const client = await pool.connect();
  let ok = false; try { ok = await deleteUserAndData(client, cid); } catch (e: any) { check('deleteUserAndData ran', false, e.message); } finally { client.release(); }
  check('deleteUserAndData returns true for a real user', ok === true, String(ok));
  const left = async (t: string, col = 'user_id', val: any = uid) => Number((await q(`select count(*) n from ${t} where ${col}=$1`, [val])).rows[0].n);
  check('user row gone', (await left('users', 'id')) === 0, '');
  for (const t of ['leads', 'user_parcel_notes', 'user_county_access', 'export_usage']) check(`${t} rows gone`, (await left(t)) === 0, '');
  check('ai_usage rows gone', (await left('ai_usage', 'user_id', cid)) === 0, '');
  const after = { users: Number((await q('select count(*) n from users')).rows[0].n), leads: Number((await q('select count(*) n from leads')).rows[0].n), notes: Number((await q('select count(*) n from user_parcel_notes')).rows[0].n) };
  check('nobody else was touched', after.users === before.users && after.leads === before.leads && after.notes === before.notes, JSON.stringify({ before, after }));
  const c2 = await pool.connect(); let again = true; try { again = await deleteUserAndData(c2, cid); } finally { c2.release(); }
  check('deleting an unknown / already deleted user is a harmless no-op (false)', again === false, String(again));
  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
