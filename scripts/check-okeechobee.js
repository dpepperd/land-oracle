const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkOkeechobee() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB');
    
    // Check Total Count
    const countRes = await client.query("SELECT COUNT(*) FROM parcels WHERE county ILIKE 'Okeechobee'");
    const count = parseInt(countRes.rows[0].count);
    console.log(`Parcels found for 'Okeechobee' county: ${count}`);

    if (count > 0) {
        // Show sample
        const sampleRes = await client.query("SELECT * FROM parcels WHERE county ILIKE 'Okeechobee' LIMIT 1");
        console.log('Sample Parcel:', JSON.stringify(sampleRes.rows[0], null, 2));
    } else {
        console.log('No data found for Okeechobee county.');
    }

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Query Error:', err);
    process.exit(1);
  }
}

checkOkeechobee();
