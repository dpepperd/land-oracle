const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔍 Inspecting Pasco Geometry Coordinates...');

    // Get X/Y range
    const res = await client.query(`
        SELECT 
            MIN(ST_X(ST_Centroid(geom))) as min_x,
            MAX(ST_X(ST_Centroid(geom))) as max_x,
            MIN(ST_Y(ST_Centroid(geom))) as min_y,
            MAX(ST_Y(ST_Centroid(geom))) as max_y
        FROM parcels 
        WHERE county = 'Pasco'
    `);

    console.table(res.rows);

    const minX = parseFloat(res.rows[0].min_x);
    if (Math.abs(minX) > 180) {
        console.log('⚠️  coordinates are OUT OF BOUNDS for WGS84 (Lon should be -180 to 180).');
        console.log('   This confirms the data is projected (State Plane).');
    } else {
        console.log('✅ Coordinates look like Lat/Lon degrees.');
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
