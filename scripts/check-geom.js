
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkGeom() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Geom Column ---');
    const res = await client.query(`
      SELECT parcelno, geojson, geom 
      FROM parcels 
      WHERE county = 'Palm Beach' 
      LIMIT 1
    `);
    
    if (res.rows.length === 0) {
      console.log('No records found.');
    } else {
      const row = res.rows[0];
      console.log('ParcelNo:', row.parcelno);
      console.log('GeoJSON present:', !!row.geojson);
      console.log('Geom (hex):', row.geom);
      if (!row.geom) {
          console.log('❌ CRITICAL: geom column is NULL. Spatial search will FAIL.');
      } else {
          console.log('✅ geom column is populated.');
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkGeom();
