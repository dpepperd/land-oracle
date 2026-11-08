
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkBroward() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Broward Data ---');
    const res = await client.query(`
      SELECT parcel_id, parcelno, own_name, geojson 
      FROM parcels 
      WHERE county = 'Broward' 
      LIMIT 1
    `);
    
    if (res.rows.length === 0) {
      console.log('No records found.');
    } else {
      const row = res.rows[0];
      console.log('Sample Record:', row);
      
      const id = row.parcel_id; // e.g., 504210010010
      // Construct Deep Link Test
      // https://web.bcpa.net/BcpaClient/#/Parcel/504210010010
      const link = `https://web.bcpa.net/BcpaClient/#/Parcel/${id}`;
      console.log('\n--- Deep Link Test ---');
      console.log('Generated Link:', link);
      console.log('Format Logic: https://web.bcpa.net/BcpaClient/#/Parcel/{ID}');
    }
    
    // Check Total Count
    const countRes = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Broward'`);
    console.log('\nTotal Mapped Parcels:', countRes.rows[0].count);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkBroward();
