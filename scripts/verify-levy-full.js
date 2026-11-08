const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function verifyFullLoad() {
  const client = await pool.connect();
  try {
    const fs = require('fs');
    const logFile = path.join(__dirname, '..', 'verify_levy_log.txt');
    fs.writeFileSync(logFile, '🔍 Starting Final Verification for Levy...\n');

    // 1. Total Count
    const countRes = await client.query(`
        SELECT count(*) as total FROM parcels WHERE county = 'Levy'
    `);
    const total = parseInt(countRes.rows[0].total);
    fs.appendFileSync(logFile, `\n📊 Total Records: ${total.toLocaleString()}\n`);
    
    // 2. Data Health (Nulls)
    const healthRes = await client.query(`
        SELECT 
           count(*) FILTER (WHERE parcel_id IS NULL) as missing_id,
           count(*) FILTER (WHERE geom IS NULL) as missing_geom,
           count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing_coords,
           count(*) FILTER (WHERE own_name IS NULL) as missing_owner
        FROM parcels 
        WHERE county = 'Levy'
    `);
    
    fs.appendFileSync(logFile, '\n🏥 Data Health Check:\n');
    fs.appendFileSync(logFile, JSON.stringify(healthRes.rows, null, 2) + '\n');
    
    // 3. Spatial Bounds
    const boundsRes = await client.query(`
        SELECT 
           min(latitude) as min_lat, max(latitude) as max_lat,
           min(longitude) as min_lon, max(longitude) as max_lon
        FROM parcels 
        WHERE county = 'Levy'
    `);
    
    fs.appendFileSync(logFile, '\n🌍 Spatial Bounds (Levy):\n');
    fs.appendFileSync(logFile, JSON.stringify(boundsRes.rows, null, 2) + '\n');
    
    console.log('Verification Complete. Written to verify_levy_log.txt');

  } catch (err) {
      console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

verifyFullLoad();
