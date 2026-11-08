const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugStLucie() {
  try {
    const client = await pool.connect();
    
    // Check count for variations
    const c1 = await client.query("SELECT COUNT(*) FROM parcels WHERE county = 'Saint Lucie'");
    const c2 = await client.query("SELECT COUNT(*) FROM parcels WHERE county = 'St. Lucie'");
    const c3 = await client.query("SELECT COUNT(*) FROM parcels WHERE county ILIKE '%Lucie%'");
    
    console.log(`Count 'Saint Lucie': ${c1.rows[0].count}`);
    console.log(`Count 'St. Lucie': ${c2.rows[0].count}`);
    console.log(`Count '%Lucie%': ${c3.rows[0].count}`);

    // Check Sample Coordinates
    const sample = await client.query("SELECT parcel_id, latitude, longitude, geom FROM parcels WHERE county ILIKE '%Lucie%' LIMIT 5");
    console.log('Sample Records:', JSON.stringify(sample.rows, null, 2));

    client.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugStLucie();
