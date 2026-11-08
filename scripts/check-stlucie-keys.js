const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStLucie() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB');
    
    // Check Total Count
    const countRes = await client.query("SELECT COUNT(*) FROM parcels WHERE county ILIKE 'Saint Lucie'");
    const count = parseInt(countRes.rows[0].count);
    console.log(`Parcels found for 'Saint Lucie' county: ${count}`);

    if (count > 0) {
        // Show sample
        const sampleRes = await client.query("SELECT parcel_id, parcelno, own_name, own_addr1 FROM parcels WHERE county ILIKE 'Saint Lucie' LIMIT 5");
        console.log('Sample Parcel Keys:', JSON.stringify(sampleRes.rows, null, 2));
    } else {
        console.log('No data found for Saint Lucie county.');
    }

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Query Error:', err);
    process.exit(1);
  }
}

checkStLucie();
