const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// FORCE bypass SSL check
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function backfillGeom() {
  const client = await pool.connect();
  try {
    console.log("🛠️ Starting Spatial Index Backfill...");
    console.log("   (This converts your text JSON into searchable Geometry)");

    // 1. Check count of missing geom
    const checkRes = await client.query('SELECT count(*) FROM parcels WHERE geom IS NULL');
    const missingCount = parseInt(checkRes.rows[0].count);
    console.log(`\n📊 Found ${missingCount.toLocaleString()} records safely tucked in JSON but missing from Space.`);

    if (missingCount === 0) {
        console.log("✅ Good news! All records already have Geometry. You are good to go.");
        return;
    }

    // 2. Perform Update
    console.log("🚀 Backfilling... (This might take 10-20 seconds)");
    
    // The Magic Query: valid JSON -> Geometry
    const updateRes = await client.query(`
        UPDATE parcels 
        SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geojson), 4326) 
        WHERE geom IS NULL AND geojson IS NOT NULL;
    `);

    console.log(`✅ Success! Updated ${updateRes.rowCount.toLocaleString()} records.`);
    console.log("🌍 The Map should now respect your drawings.");

  } catch (err) {
    console.error("❌ Backfill Failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

backfillGeom();
