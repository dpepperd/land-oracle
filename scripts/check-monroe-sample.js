const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT parcel_id, parcelno, own_name FROM parcels WHERE county = 'Monroe' LIMIT 2");
    console.log('Sample Monroe Records:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
