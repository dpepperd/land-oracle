require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.split('?')[0],
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = '${process.argv[2] || 'parcels'}'::regclass
      AND contype IN ('u', 'p');
    `);
    
    console.log("Constraints:", res.rows);
    
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
