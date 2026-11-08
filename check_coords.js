const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' }); // Load .env.local explicitly

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCoords() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT parcel_id, latitude, longitude FROM parcels LIMIT 3');
    console.log('--- DB COORDINATE SAMPLES ---');
    res.rows.forEach(row => {
        console.log(`ID: ${row.parcel_id}, Lat: ${row.latitude} (${typeof row.latitude}), Lon: ${row.longitude} (${typeof row.longitude})`);
    });
    console.log('-----------------------------');
    client.release();
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkCoords();
