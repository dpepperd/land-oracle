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
    const bbox = await client.query(`
        SELECT 
            MIN(ST_X(ST_Centroid(geom))) as min_lon,
            MAX(ST_X(ST_Centroid(geom))) as max_lon,
            MIN(ST_Y(ST_Centroid(geom))) as min_lat,
            MAX(ST_Y(ST_Centroid(geom))) as max_lat
        FROM parcels 
        WHERE county = 'Sumter'
    `);
    
    console.log('BBox:', JSON.stringify(bbox.rows[0], null, 2));

    const samples = await client.query(`
        SELECT parcel_id, phy_addr1, phy_city, 
               ST_Y(ST_Centroid(geom)) as lat, 
               ST_X(ST_Centroid(geom)) as lon
        FROM parcels 
        WHERE county = 'Sumter' AND phy_addr1 IS NOT NULL
        LIMIT 3
    `);
    
    console.log('Samples:', JSON.stringify(samples.rows, null, 2));

  } catch (e) { console.error(e); } finally { client.release(); pool.end(); }
}
run();
