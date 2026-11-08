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
        console.log('🌍 Starting Global Coordinate Fix...');
        
        // 1. Identify affected counties
        const res = await client.query(`
            SELECT county, count(*) as cnt
            FROM parcels
            WHERE (latitude IS NULL OR longitude IS NULL) 
              AND geom IS NOT NULL
            GROUP BY county
            ORDER BY cnt DESC
        `);
        
        if (res.rows.length === 0) {
            console.log('✅ No counties need fixing.');
            return;
        }

        console.log(`found ${res.rows.length} counties with missing coordinates.`);

        // 2. Fix each county
        for (const row of res.rows) {
            console.log(`🔧 Fixing ${row.county.padEnd(15)} (${parseInt(row.cnt).toLocaleString()} records)...`);
            
            const updateRes = await client.query(`
                UPDATE parcels 
                SET 
                    latitude = ST_Y(ST_Centroid(ST_MakeValid(geom))),
                    longitude = ST_X(ST_Centroid(ST_MakeValid(geom)))
                WHERE county = $1 
                  AND (latitude IS NULL OR longitude IS NULL)
                  AND geom IS NOT NULL
            `, [row.county]);
            
            console.log(`   ✅ Updated ${updateRes.rowCount} records.`);
        }
        
        console.log('\n🎉 Global Fix Complete!');
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
