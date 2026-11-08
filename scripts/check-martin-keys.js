const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMartin() {
  try {
    const client = await pool.connect();
    
    // Check Total Count
    const countRes = await client.query("SELECT COUNT(*) FROM parcels WHERE county ILIKE 'Martin'");
    const count = parseInt(countRes.rows[0].count);
    console.log(`Parcels found for 'Martin' county: ${count}`);

    if (count > 0) {
        // Show sample keys
        const sampleRes = await client.query("SELECT parcel_id, parcelno, own_name FROM parcels WHERE county ILIKE 'Martin' LIMIT 10");
        console.log('Sample Parcel Keys:', JSON.stringify(sampleRes.rows, null, 2));
    }

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Query Error:', err);
    process.exit(1);
  }
}

checkMartin();
