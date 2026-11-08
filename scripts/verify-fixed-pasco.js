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
    console.log('🧪 Verifying Fixed Records...');
    
    // Find a valid one
    const res = await client.query(`
        SELECT gid, parcelno, ST_AsText(geom) as wkt
        FROM parcels 
        WHERE county = 'Pasco' 
          AND ST_X(ST_Centroid(geom)) BETWEEN -83 AND -81
        LIMIT 1
    `);
    
    if (res.rows.length > 0) {
        console.log('✅ Found a fixed record!');
        console.log(`GID: ${res.rows[0].gid}`);
        console.log(`WKT: ${res.rows[0].wkt.substring(0, 50)}...`);
    } else {
        console.log('❌ No fixed records found yet (or query failed).');
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
