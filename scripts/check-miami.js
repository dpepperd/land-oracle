
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMiami() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Miami-Dade Data ---');
    
    // Check Count
    const countRes = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Miami-Dade'`);
    console.log('Total Records:', countRes.rows[0].count);

    // Sample Records
    const res = await client.query(`
      SELECT parcel_id, parcelno, own_name, own_city 
      FROM parcels 
      WHERE county = 'Miami-Dade' 
      LIMIT 3
    `);

    res.rows.forEach(r => {
        console.log('\nRecord:', r);
        const pid = r.parcel_id;
        // Check formatting for: https://apps.miamidadepa.gov/PropertySearch/#/?folio={ID}
        // Expected ID: 1079190281380 or similar (13 digits)
        const link = `https://apps.miamidadepa.gov/PropertySearch/#/?folio=${pid}`;
        console.log('Generated Link:', link);
    });

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkMiami();
