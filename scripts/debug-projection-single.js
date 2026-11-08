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
    console.log('🧪 Testing Single Record Transformation...');
    
    // Get one record
    const res = await client.query(`SELECT gid, geojson FROM parcels WHERE county = 'Pasco' LIMIT 1`);
    const row = res.rows[0];
    
    console.log(`GID: ${row.gid}`);
    console.log(`GeoJSON Start: ${row.geojson.substring(0, 50)}...`);

    // Try Transform Query
    const testQuery = `
        SELECT ST_AsText(
            ST_Transform(
                ST_SetSRID(
                    ST_Multi(ST_Force2D(ST_GeomFromGeoJSON($1))), 
                    2882
                ), 
                4326
            )
        ) as wkt
    `;
    
    try {
        const trans = await client.query(testQuery, [row.geojson]);
        console.log('✅ Transformation Success!');
        console.log(`Result WKT: ${trans.rows[0].wkt.substring(0, 100)}...`);
    } catch (e) {
        console.error('❌ Transformation Query Failed:', e.message);
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
