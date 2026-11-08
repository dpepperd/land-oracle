const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCodes() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT dor_uc, count(*) FROM parcels GROUP BY dor_uc ORDER BY count(*) DESC LIMIT 20');
    console.log('Top 20 Land Use Codes:');
    console.table(res.rows);
    
    // Check Market Value type
    const typeRes = await client.query("SELECT pg_typeof(jv) FROM parcels LIMIT 1");
    console.log('JV Column Type:', typeRes.rows[0].pg_typeof);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkCodes();
