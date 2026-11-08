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
        console.log('🔧 Fixing Levy Coordinates (calculating from geom)...');
        
        const res = await client.query(`
            UPDATE parcels 
            SET 
                latitude = ST_Y(ST_Centroid(ST_MakeValid(geom))),
                longitude = ST_X(ST_Centroid(ST_MakeValid(geom)))
            WHERE county = 'Levy' 
              AND latitude IS NULL 
              AND geom IS NOT NULL
              AND ST_IsValid(geom) IS FALSE;

            UPDATE parcels 
            SET 
                latitude = ST_Y(ST_Centroid(geom)),
                longitude = ST_X(ST_Centroid(geom))
            WHERE county = 'Levy' 
              AND latitude IS NULL 
              AND geom IS NOT NULL
              AND ST_IsValid(geom) IS TRUE;
        `);
        
        console.log(`✅ Updated ${res.rowCount} records with new coordinates.`);
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
