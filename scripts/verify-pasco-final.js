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
    console.log('📊 Verifying Pasco Data Load...');

    const res = await client.query(`
        SELECT count(*) as total,
               count(*) FILTER (WHERE geom IS NOT NULL) as valid_geom,
               count(*) FILTER (WHERE dor_uc IS NOT NULL) as valid_dor
        FROM parcels 
        WHERE county = 'Pasco'
    `);
    
    console.log('--- Database Stats ---');
    console.log(`Total Records: ${res.rows[0].total}`);
    console.log(`With Geometry: ${res.rows[0].valid_geom}`);
    console.log(`With Land Use: ${res.rows[0].valid_dor}`);
    console.log('----------------------');

    if (parseInt(res.rows[0].total) > 310000) {
        console.log('✅ Count looks correct (~314k expected).');
    } else {
        console.log('⚠️ Count seems low.');
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
