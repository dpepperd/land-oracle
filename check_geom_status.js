const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkGeom() {
  const client = await pool.connect();
  try {
    console.log("🔍 Checking Geometry Column Status...");

    // Count Total
    const totalRes = await client.query('SELECT count(*) FROM parcels');
    const total = parseInt(totalRes.rows[0].count);

    // Count Null Geom
    const nullRes = await client.query('SELECT count(*) FROM parcels WHERE geom IS NULL');
    const nullCount = parseInt(nullRes.rows[0].count);

    // Count Valid Geom
    const validCount = total - nullCount;

    console.log(`\n📊 Status Report:`);
    console.log(`   Total Parcels: ${total.toLocaleString()}`);
    console.log(`   Valid Geoms:   ${validCount.toLocaleString()} (${((validCount/total)*100).toFixed(1)}%)`);
    console.log(`   Null Geoms:    ${nullCount.toLocaleString()}`);

    if (validCount > 0) {
        // Inspect one
        const sample = await client.query('SELECT ST_SRID(geom) as srid, ST_AsText(geom) as text FROM parcels WHERE geom IS NOT NULL LIMIT 1');
        console.log(`\n✅ Sample Geometry:`);
        console.log(`   SRID: ${sample.rows[0].srid}`);
        console.log(`   WKT:  ${sample.rows[0].text.substring(0, 50)}...`);
    } else {
        console.log("\n❌ PROBLEM: You have data but NO Geometry.");
        console.log("   Since the 'geojson' text column is also missing, you CANNOT backfill.");
        console.log("   You must RE-RUN the content loader script to import data again.");
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkGeom();
