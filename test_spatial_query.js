const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testSpatial() {
  const client = await pool.connect();
  try {
    console.log("📐 Testing Spatial Query Logic...");

    // 1. Define a small test polygon in Baker County (approx coordinates)
    // A small triangle near Macclenny
    const testPoly = {
        type: 'Polygon',
        coordinates: [[
            [-82.15, 30.28],
            [-82.12, 30.28],
            [-82.135, 30.30],
            [-82.15, 30.28] // Close loop
        ]]
    };
    
    console.log("   Test Polygon defined.");

    // 2. Run Query
    const query = `
        SELECT 
            parcel_id, 
            ST_AsText(geom) as geom_wkt,
            ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), geom) as is_inside
        FROM parcels
        WHERE geom && ST_MakeEnvelope(-82.16, 30.27, -82.11, 30.31, 4326) -- rough bbox
        AND ST_Intersects(geom, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
        LIMIT 5;
    `;
    
    const res = await client.query(query, [JSON.stringify(testPoly)]);
    
    console.log(`\n📊 Query Results (${res.rows.length}):`);
    res.rows.forEach(row => {
        console.log(`   Parcel: ${row.parcel_id}`);
        console.log(`   Is Theoretically Inside? ${row.is_inside}`); 
        // Note: matches ST_Intersects (touching/inside) but ST_Contains might be false if boundary touch
        console.log(`   WKT: ${row.geom_wkt.substring(0, 50)}...`);
    });

    if (res.rows.length === 0) {
        console.log("   (No results found in this tiny test area. Try drawing a bigger box)");
    } else {
        console.log("\n✅ Query executed. If 'is_inside' is true, logic holds.");
    }

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

testSpatial();
