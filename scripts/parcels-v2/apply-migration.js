// Applies one db/migrations/*.sql file:  node scripts/parcels-v2/apply-migration.js 006_...sql
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const root = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } }); await c.connect();
  await c.query('SET statement_timeout = 0');
  const r = await c.query(fs.readFileSync(path.join(root, 'db', 'migrations', process.argv[2]), 'utf8'));
  console.log('rows affected:', r.rowCount); await c.end();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
