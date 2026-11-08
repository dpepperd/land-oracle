const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('️🩹 Backfilling NULL geometry for Sarasota...');
    
    // Default to Sarasota Centroid
    // Lon: -82.4542, Lat: 27.2038
    const query = `
        UPDATE parcels 
        SET geom = ST_SetSRID(ST_Multi(ST_Buffer(ST_MakePoint(-82.4542, 27.2038), 0.0001)), 4326)
        WHERE county = 'Sarasota' AND geom IS NULL
    `;
    
    const res = await client.query(query);
    console.log(`✅ Updated ${res.rowCount} records with default centroid.`);
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
