const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyBaker() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verifying Baker County Data...');

    // 1. Total Count
    // Note: 'Baker' in DB is Title Case based on sample
    const countRes = await client.query(`SELECT COUNT(*) FROM parcels WHERE county = 'Baker'`);
    const total = parseInt(countRes.rows[0].count);
    console.log(`\n📊 Total Baker Parcels: ${total}`);

    // 2. Geometry Check
    // Columns: geojson, latitude, longitude
    const geoRes = await client.query(`
        SELECT 
            COUNT(*) FILTER (WHERE geojson IS NOT NULL) as valid_geom,
            COUNT(*) FILTER (WHERE geojson IS NULL) as null_geom,
            COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as valid_latlon,
            COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as null_latlon
        FROM parcels 
        WHERE county = 'Baker'
    `);
    
    const { valid_geom, null_geom, valid_latlon, null_latlon } = geoRes.rows[0];
    console.log(`   - With Geometry: ${valid_geom} (${(valid_geom/total*100).toFixed(1)}%)`);
    console.log(`   - Null Geometry: ${null_geom}`);
    console.log(`   - With Lat/Lon:  ${valid_latlon}`);
    console.log(`   - Null Lat/Lon:  ${null_latlon}`);

    // 3. Sample Check (Coordinate Bounds)
    // Baker is roughly 30.1-30.6N, 82.0-82.5W
    const boundsRes = await client.query(`
        SELECT MIN(latitude) as min_lat, MAX(latitude) as max_lat, MIN(longitude) as min_lon, MAX(longitude) as max_lon 
        FROM parcels 
        WHERE county = 'Baker' AND latitude IS NOT NULL
    `);
    const { min_lat, max_lat, min_lon, max_lon } = boundsRes.rows[0];
    console.log(`\n📍 Coordinate Bounds:`);
    console.log(`   - Lat: ${Number(min_lat).toFixed(4)} to ${Number(max_lat).toFixed(4)}`);
    console.log(`   - Lon: ${Number(min_lon).toFixed(4)} to ${Number(max_lon).toFixed(4)}`);

    const expectedLat = (min_lat > 30.0 && max_lat < 31.0);
    const expectedLon = (min_lon > -82.8 && max_lon < -82.0);

    if (expectedLat && expectedLon) {
        console.log(`✅ Coordinates look correct for Baker County.`);
    } else {
        console.warn(`⚠️  Coordinates might be out of range!`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

verifyBaker();
