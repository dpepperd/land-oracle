const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT count(*) FROM parcels WHERE county = 'Miami-Dade'");
    console.log('Final Miami-Dade Count:', res.rows[0].count);
    
    // Check condo breakdown (DOR 04)
    const condoRes = await client.query("SELECT count(*) FROM parcels WHERE county = 'Miami-Dade' AND (dor_code = '04' OR dor_code = '4')");
    console.log('Condo Records (DOR 04):', condoRes.rows[0].count);
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
