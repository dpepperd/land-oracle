const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugSpatial() {
  const client = await pool.connect();
  try {
    console.log("🔍 Sample Parcel Geometry Check...");

    // Fetch 1 parcel with both text geojson and postgis geom
    const res = await client.query(`
      SELECT 
        parcel_id, 
        substring(geojson from 1 for 100) as raw_geojson_snippet,
        ST_AsGeoJSON(geom) as geom_geojson,
        ST_SRID(geom) as srid
      FROM parcels 
      WHERE geom IS NOT NULL 
      LIMIT 1;
    `);

    if (res.rows.length === 0) {
        console.log("❌ NO RECORDS found with 'geom' populated!");
        console.log("   (This means the spatial column is empty, so spatial search fails.)");
        
        // Check if we have ANY records
        const countRes = await client.query('SELECT count(*) FROM parcels');
        console.log(`   Total Parcels in Table: ${countRes.rows[0].count}`);
    } else {
        const row = res.rows[0];
        console.log("✅ Found Record:", row.parcel_id);
        console.log("   SRID:", row.srid);
        console.log("   Raw JSON (Input):", row.raw_geojson_snippet);
        console.log("   PostGIS Geom (Output):", row.geom_geojson.substring(0, 100));
        
        // Check coordinate order (rough heuristic)
        // FL Longitude is -80 to -87 (Negative). Latitude is 24 to 31 (Positive).
        const geom = JSON.parse(row.geom_geojson);
        let coord;
        if (geom.type === 'Point') coord = geom.coordinates;
        else if (geom.type === 'Polygon') coord = geom.coordinates[0][0];
        else if (geom.type === 'MultiPolygon') coord = geom.coordinates[0][0][0];
        
        if (coord) {
             const [x, y] = coord;
             console.log(`   Sample Coord: [${x}, ${y}]`);
             if (x > 0 && y < 0) {
                 console.log("   ⚠️ WARNING: Looks like Lat/Lon (flipped). Expecting Lon/Lat (Neg/Pos).");
             } else if (x < 0 && y > 0) {
                 console.log("   ✅ Looks like Lon/Lat (Correct for PostGIS 4326).");
             } else {
                 console.log("   ❓ Indeterminate coordinates.");
             }
        }
    }

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

debugSpatial();
