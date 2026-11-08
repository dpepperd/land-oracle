const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  console.log('Checking Pinellas record count...');
  const res = await client.query("SELECT COUNT(*) FROM parcels WHERE county = 'Pinellas'");
  console.log(`\n✅ Pinellas Count: ${parseInt(res.rows[0].count).toLocaleString()}`);
  
  const sample = await client.query("SELECT parcel_id, own_name, own_addr1, city, zip FROM parcels WHERE county = 'Pinellas' LIMIT 1");
  if (sample.rows.length > 0) {
      console.log('\nSample Record:');
      console.log(sample.rows[0]);
  }
  
  client.release();
  await pool.end();
}

check().catch(e => console.error(e));
