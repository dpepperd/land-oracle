const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM pg_indexes WHERE tablename = 'parcels'");
    console.log('Indexes on parcels table:');
    if (res.rows.length === 0) {
        console.log("NO INDEXES FOUND!");
    } else {
        res.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
