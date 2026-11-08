
const { Pool } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const resCount = await pool.query("SELECT count(*) FROM parcels WHERE county = 'Volusia'");
    console.log("Count:", resCount.rows[0].count);

    const resSample = await pool.query("SELECT gid, parcel_id, dor_uc FROM parcels WHERE county = 'Volusia' LIMIT 5");
    console.log("Samples:", resSample.rows);
    
    // Check geometry SRS if possible (optional, lat/lon usually tells the story)
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
