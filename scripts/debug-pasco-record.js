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
    console.log('🔍 Inspecting Pasco Records...');

    // 1. Get a sample
    const res = await client.query(`
        SELECT 
            gid, parcel_id, parcelno, 
            substring(geojson, 1, 100) as geojson_preview, 
            ST_AsText(geom) as geom_text,
            ST_IsValid(geom) as is_valid,
            latitude, longitude, county
        FROM parcels 
        WHERE county = 'Pasco' 
        LIMIT 3
    `);

    console.log('Sample Records:');
    res.rows.forEach(r => console.log(r));

    // 2. Check for NULL geoms
    const nullGeom = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Pasco' AND geom IS NULL`);
    console.log(`\nRecords with NULL geom: ${nullGeom.rows[0].count}`);

    // 3. Check for NULL parcelno
    const nullNo = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Pasco' AND parcelno IS NULL`);
    console.log(`Records with NULL parcelno: ${nullNo.rows[0].count}`);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
