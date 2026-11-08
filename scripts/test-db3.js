const { Client } = require('pg');
const fs = require('fs');
async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  fs.writeFileSync('tables.json', JSON.stringify(res.rows.map(r=>r.table_name), null, 2));
  await client.end();
}
check().catch(console.error);
