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
    console.log('REPAIRING PASCO GEOMETRY...');
    
    // 1. Check count of bad records
    const res = await client.query("SELECT count(*) FROM parcels WHERE county = 'Pasco' AND geom IS NULL");
    const totalToFix = parseInt(res.rows[0].count);
    console.log(`Found ${totalToFix} records with missing geometry.`);

    if (totalToFix === 0) {
        console.log('✅ No repairs needed.');
        return;
    }

    // 2. Run Update in Batches (to avoid timeout on 300k rows)
    const BATCH_SIZE = 10000;
    let processed = 0;

    while (processed < totalToFix) {
        console.log(`Processing batch starting at offset ${processed}...`);
        
        // We use a CTE to limit the update scope for performance
        // Note: Using CTID or just limiting the update where geom is null
        // Since we are updating specific rows, we can just target WHERE geom IS NULL LIMIT N
        // But Postgres UPDATE doesn't support LIMIT directly in standard SQL consistently without subquery.
        // Easiest reliable way:
        
        const updateQuery = `
            WITH rows_to_update AS (
                SELECT gid FROM parcels 
                WHERE county = 'Pasco' AND geom IS NULL
                LIMIT ${BATCH_SIZE}
            )
            UPDATE parcels p
            SET geom = ST_SetSRID(ST_Multi(ST_Force2D(ST_GeomFromGeoJSON(p.geojson))), 4326)
            FROM rows_to_update r
            WHERE p.gid = r.gid;
        `;

        const result = await client.query(updateQuery);
        const count = result.rowCount;
        
        processed += count;
        console.log(`   Updated ${count} records. Total: ${processed}/${totalToFix}`);
        
        if (count === 0) break; // Should not happen if count was accurate, but safety break
    }

    console.log('✅ Pasco Geometry Repair Complete.');
    
    // 3. Final Verify
    const verify = await client.query("SELECT count(*) FROM parcels WHERE county = 'Pasco' AND geom IS_VALID");
    console.log(`Valid Geometries: ${verify.rows[0].count}`);

  } catch (e) {
    console.error('❌ Repair Failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
