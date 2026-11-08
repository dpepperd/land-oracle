require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_parcel_notes';
    `);
    
    console.log("Indexes:", res.rows);
    
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
