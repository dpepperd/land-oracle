// Gives an account owner-contact (skip trace) credits. Usage: node scripts/launch/skiptrace-grant.cjs <email> <amount> [schema]
// Uses DATABASE_URL from .env.local, which is the DEVELOPMENT database. For production pass the schema explicitly (app_prod) and run it deliberately.
// Prints the new balance only (no personal data). The migration db/migrations/016_skip_trace.sql must already be applied in that schema.
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const [email, amountRaw, schema = 'public'] = process.argv.slice(2);
const amount = Number(amountRaw);
if (!email || !Number.isInteger(amount) || amount <= 0 || !/^[a-z_]+$/.test(schema)) { console.error('Usage: node scripts/launch/skiptrace-grant.cjs <email> <positive whole number> [schema]'); process.exit(1); }
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
(async () => {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const u = (await pool.query(`SELECT id FROM ${schema}.users WHERE lower(email) = lower($1)`, [email])).rows[0];
    if (!u) { console.error('No such user in schema ' + schema); process.exitCode = 1; return; }
    const r = await pool.query(
      `INSERT INTO ${schema}.skip_trace_credits (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = ${schema}.skip_trace_credits.balance + EXCLUDED.balance, updated_at = now() RETURNING balance`, [u.id, amount]);
    console.log(`schema ${schema}: balance is now ${r.rows[0].balance}`);
  } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await pool.end(); }
})();
