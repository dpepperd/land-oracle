
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkPalm() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Palm Beach Records ---');
    const res = await client.query(`
      SELECT parcel_id, own_name, latitude, longitude, county 
      FROM parcels 
      WHERE county = 'Palm Beach' 
      LIMIT 1
    `);
    
    if (res.rows.length === 0) {
      console.log('❌ No records found for "Palm Beach".');
    } else {
      console.log('✅ Found record:', res.rows[0]);
      if (res.rows[0].latitude === null || res.rows[0].longitude === null) {
        console.log('⚠️ WARNING: Coordinates are NULL! This explains map invisibility.');
      } else {
        console.log('✅ Coordinates look valid.');
      }
    }

    // console.log('\n--- Checking User Access ---');
    // // Assuming 'Dirk' or admin user. Let's list all access for now.
    // const accessRes = await client.query(`
    //   SELECT * FROM user_county_access WHERE county = 'Palm Beach'
    // `);
    // if (accessRes.rows.length === 0) {
    //     console.log('❌ No users have explicit access to "Palm Beach" in user_county_access table.');
    // } else {
    //     console.log('✅ Users with access:', accessRes.rows);
    // }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkPalm();
