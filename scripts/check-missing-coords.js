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
        console.log('🌍 Checking for Missing Coordinates Globally...');
        
        const res = await client.query(`
            SELECT county, count(*) as missing_count
            FROM parcels
            WHERE (latitude IS NULL OR longitude IS NULL) 
              AND geom IS NOT NULL
            GROUP BY county
            ORDER BY missing_count DESC
        `);
        
        if (res.rows.length === 0) {
            console.log('✅ All counties have valid Lat/Lon!');
        } else {
            console.log('⚠️  Counties with Missing Coords (but valid Geom):');
            console.table(res.rows);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
