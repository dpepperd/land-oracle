const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking indexes on "parcels" table...');
    const res = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'parcels';
    `);
    console.log('Indexes on "parcels":');
    res.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
    if (res.rows.length === 0) console.log('(No indexes found)');
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
