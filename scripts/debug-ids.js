const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkIds() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking ID Columns for St. Johns...');
    const res = await client.query(`
        SELECT parcel_id, parcelno, county 
        FROM parcels 
        WHERE county = 'Saint Johns' 
        LIMIT 5;
    `);
    
    if (res.rows.length === 0) {
        console.log('❌ No records found.');
    } else {
        console.table(res.rows);
    }

    console.log('\n🔍 Checking ID Columns for Baker (Reference)...');
    const resBaker = await client.query(`
        SELECT parcel_id, parcelno, county 
        FROM parcels 
        WHERE county = 'Baker' 
        LIMIT 1;
    `);
    console.table(resBaker.rows);

  } catch (err) {
      console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkIds();
