require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Checking coords for parcel 011N19000000000010...");
    
    const res = await client.query(`
      SELECT parcel_id, latitude, longitude, geojson 
      FROM parcels 
      WHERE parcel_id = '011N19000000000010'
    `);
    
    console.log("Parcel Data:", JSON.stringify(res.rows[0], null, 2));
    
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
