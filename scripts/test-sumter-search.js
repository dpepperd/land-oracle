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
    console.log('🧪 Testing Sumter Search for Single Family (001)...');
    
    // Simulate what the API does
    const landUseCodes = ['001'];
    
    // Check Count
    const countRes = await client.query(`
        SELECT count(*) 
        FROM parcels 
        WHERE county = 'Sumter' 
        AND dor_uc = ANY($1::text[])
    `, [landUseCodes]);
    
    console.log(`Phase 1: Direct SQL Count for ['001']: ${countRes.rows[0].count}`);

    // Check Geometry validity for these records
    const geomRes = await client.query(`
        SELECT count(*) 
        FROM parcels 
        WHERE county = 'Sumter' 
        AND dor_uc = '001'
        AND geom IS NOT NULL
        AND ST_IsValid(geom)
    `);
    console.log(`Phase 2: Valid Geometry Count: ${geomRes.rows[0].count}`);

    // Check if they are visible in a typical bbox (Entire county rough bbox)
    // Sumter bbox approx: -82.3, 28.5 to -81.9, 29.0
    const bboxCount = await client.query(`
        SELECT count(*) 
        FROM parcels 
        WHERE county = 'Sumter' 
        AND dor_uc = '001'
        AND geom && ST_MakeEnvelope(-82.3, 28.5, -81.9, 29.0, 4326)
    `);
    console.log(`Phase 3: BBOX Visibility Test: ${bboxCount.rows[0].count}`);
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
