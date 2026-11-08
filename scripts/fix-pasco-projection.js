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
    console.log('🌍 REPROJECTING PASCO GEOMETRY (EPSG:2882 -> EPSG:4326)...');
    
    // We already have `geojson` populated with raw coordinates.
    // They are currently tagged as 4326 in `geom` (ERROR).
    // We must re-parse `geojson`, tag as 2882, then transform to 4326.

    const BATCH_SIZE = 10000;
    
    // Check total
    const check = await client.query("SELECT count(*) FROM parcels WHERE county = 'Pasco'");
    const total = parseInt(check.rows[0].count);
    console.log(`Total Pasco records: ${total}`);

    let processed = 0;
    while (processed < total) {
        // We use the same batch update strategy using LIMIT
        // Note: We need to filter where ST_SRID(geom) = 4326 AND ST_X(centroid) > 180 (incorrectly tagged projected coords)
        // OR simpler: just update all since we established all are wrong.
        // To be safe and resume-able, let's update all Pasco records where we haven't fixed it yet?
        // But how to detect "fixed"? 
        // Fixed records will have X coordinate between -180 and 180.
        // Broken records have X > 180 (500k).
        
        console.log(`Processing batch... `);

        // Update 10k items where X coord of centroid is out of bounds for WGS84
        // Logic: ST_X(ST_Centroid(geom)) > 180 means it is NOT valid WGS84
        
        // Updated query with ST_MakeValid and error handling logic implied by smaller batches/retries?
        // Let's use ST_MakeValid and ignore errors if possible or catch them.
        // Actually, XX000 often kills the statement.
        // We will try to filter inputs that result in valid 4326 output.
        
        const updateQuery = `
            WITH rows_to_fix AS (
                SELECT gid, geojson
                FROM parcels 
                WHERE county = 'Pasco' 
                  AND (ST_X(ST_Centroid(geom)) > 180 OR ST_Y(ST_Centroid(geom)) > 90)
                LIMIT ${BATCH_SIZE}
            )
            UPDATE parcels p
            SET geom = ST_MakeValid(ST_Transform(
                ST_SetSRID(
                    ST_Multi(ST_Force2D(ST_GeomFromGeoJSON(p.geojson))), 
                    2882
                ), 
                4326
            ))
            FROM rows_to_fix r
            WHERE p.gid = r.gid;
        `;

        const res = await client.query(updateQuery);
        const count = res.rowCount;
        processed += count;
        
        console.log(`   Reprojected ${count} records.`);
        
        if (count === 0) {
            console.log('   No more bad records found.');
            break;
        }
    }
    
    console.log('✅ Projection Repair Complete.');
    
    // Validate
    const sample = await client.query(`
        SELECT ST_AsText(geom) as wkt, ST_X(ST_Centroid(geom)) as lon 
        FROM parcels WHERE county = 'Pasco' LIMIT 1
    `);
    console.log('Sample Validated:', sample.rows[0]);

  } catch (e) {
    console.error('❌ Reprojection Failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
