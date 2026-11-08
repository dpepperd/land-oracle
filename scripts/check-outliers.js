const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function findOutliers() {
  const client = await pool.connect();
  try {
    // Duval County is roughly East of -82.0 longitude.
    // Baker County is roughly -82.4 to -82.1.
    // Let's find Baker parcels that are significantly east.
    
    console.log('Searching for Baker County parcels that seem to be in Duval (Longitude > -81.9)...');
    
    const res = await client.query(`
      SELECT id, parcel_id, latitude, longitude, property_address 
      FROM parcels 
      WHERE county = 'Baker' 
      AND longitude > -81.9
    `);
    
    if (res.rows.length === 0) {
      console.log('No outliers found east of -81.9');
    } else {
      console.log(`Found ${res.rows.length} outliers:`);
      res.rows.forEach(r => console.log(r));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

findOutliers();
