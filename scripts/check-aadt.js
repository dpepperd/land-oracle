const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT COUNT(*) FROM traffic_stats');
    console.log(`✅ Traffic Stats Count: ${res.rows[0].count}`);
    
    const sample = await client.query('SELECT * FROM traffic_stats LIMIT 1');
    console.log('Sample Record:', sample.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
