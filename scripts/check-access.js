const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkAccess() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking `user_county_access` table...');
    const res = await client.query(`
      SELECT * FROM user_county_access ORDER BY created_at DESC LIMIT 10;
    `);
    
    if (res.rows.length === 0) {
        console.log('⚠️ Table is empty!');
    } else {
        console.table(res.rows);
    }

    // Check distinct counties
    const countyRes = await client.query(`SELECT DISTINCT county FROM parcels ORDER BY county`);
    console.log('\n🗺️ Counties in `parcels` table:');
    console.table(countyRes.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkAccess();
