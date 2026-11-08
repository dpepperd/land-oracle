const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT parcel_id FROM parcels WHERE county = 'Hillsborough' LIMIT 5`);
    console.log('Sample Hillsborough IDs:');
    res.rows.forEach(r => console.log(r.parcel_id));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
check();
