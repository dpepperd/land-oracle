const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkBaker() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking Baker County Records...');
    // count total, and count where parcelno is NOT NULL
    const res = await client.query(`
        SELECT 
           count(*) as total_rows, 
           count(parcelno) as rows_with_parcelno,
           count(parcel_id) as rows_with_parcel_id
        FROM parcels 
        WHERE county = 'Baker';
    `);
    
    console.table(res.rows);
    
    const row = res.rows[0];
    if (row.rows_with_parcelno > 0 && row.rows_with_parcelno == row.total_rows) {
        console.log('✅ Baker County is PERFECT. 100% of records have parcelno.');
    } else {
        console.warn('⚠️ Baker County has some missing parcelno values.');
    }

  } catch (err) {
      console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkBaker();
