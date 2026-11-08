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
    console.log('📉 Monitoring Pasco Reprojection Progress...');

    const res = await client.query(`
        SELECT count(*) 
        FROM parcels 
        WHERE county = 'Pasco' 
          AND ST_X(ST_Centroid(geom)) > 180
    `);
    
    console.log(`Remaining Records with X > 180: ${res.rows[0].count}`);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
