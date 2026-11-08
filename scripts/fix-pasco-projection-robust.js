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
    console.log('🛡️  ROBUST PASCO REPROJECTION START (EPSG:2882 -> 4326)...');

    // 1. Fetch Candidates (IDs where X > 180, indicating projected coords in 4326 column)
    console.log('   Fetching candidates...');
    const res = await client.query(`
        SELECT gid 
        FROM parcels 
        WHERE county = 'Pasco'
    `);
    
    const candidates = res.rows.map(r => r.gid);
    console.log(`   Found ${candidates.length} records to fix.`);

    // 2. Process in Batches
    const BATCH_SIZE = 1000;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batchIds = candidates.slice(i, i + BATCH_SIZE);
        
        try {
            await updateBatch(client, batchIds);
            successCount += batchIds.length;
            if (successCount % 5000 === 0) console.log(`   Fixed ${successCount}/${candidates.length}...`);
        } catch (e) {
            console.log(`   ⚠️ Batch failed at index ${i}. Retrying item-by-item...`);
            // Fallback: Item by Item
            for (const id of batchIds) {
                try {
                    await updateBatch(client, [id]);
                    successCount++;
                } catch (innerE) {
                    console.error(`   ❌ Failed Record GID: ${id} - ${innerE.message}`);
                    errorCount++;
                }
            }
        }
    }

    console.log('✅ Robust Repair Complete.');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);

  } catch (e) {
    console.error('❌ Script Fatal Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}

async function updateBatch(client, ids) {
    if (ids.length === 0) return;
    const query = `
        UPDATE parcels p
        SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Transform(
            ST_SetSRID(
                ST_Multi(ST_Force2D(ST_GeomFromGeoJSON(p.geojson))), 
                2882
            ), 
            4326
        )), 3))
        WHERE p.gid = ANY($1)
    `;
    await client.query(query, [ids]);
}

run();
