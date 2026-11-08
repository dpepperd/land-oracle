const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyFullLoad() {
  const client = await pool.connect();
  try {
    const fs = require('fs');
    const logFile = path.join(__dirname, '..', 'verify_log.txt');
    fs.writeFileSync(logFile, '🔍 Starting Final Verification for Saint Johns...\n');

    // 1. Total Count
    const countRes = await client.query(`
        SELECT count(*) as total FROM parcels WHERE county = 'Saint Johns'
    `);
    const total = parseInt(countRes.rows[0].total);
    fs.appendFileSync(logFile, `\n📊 Total Records: ${total.toLocaleString()}\n`);
    
    if (total < 100000) {
        fs.appendFileSync(logFile, '⚠️ WARNING: Record count seems low for St. Johns (Expected ~160k+)\n');
    } else {
        fs.appendFileSync(logFile, '✅ Count looks correct.\n');
    }

    // 2. Data Health (Nulls)
    const healthRes = await client.query(`
        SELECT 
           count(*) FILTER (WHERE parcelno IS NULL) as missing_legacy_id,
           count(*) FILTER (WHERE parcel_id IS NULL) as missing_new_id,
           count(*) FILTER (WHERE geom IS NULL) as missing_geom,
           count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as missing_coords,
           count(*) FILTER (WHERE own_name IS NULL) as missing_owner
        FROM parcels 
        WHERE county = 'Saint Johns'
    `);
    
    fs.appendFileSync(logFile, '\n🏥 Data Health Check:\n');
    fs.appendFileSync(logFile, JSON.stringify(healthRes.rows, null, 2) + '\n');
    
    const h = healthRes.rows[0];
    if (parseInt(h.missing_legacy_id) > 0) fs.appendFileSync(logFile, '❌ CRITICAL: Missing parcelno!\n');
    if (parseInt(h.missing_geom) > 0) fs.appendFileSync(logFile, '❌ CRITICAL: Missing Geometry!\n');
    
    // 3. Spatial Bounds
    const boundsRes = await client.query(`
        SELECT 
           min(latitude) as min_lat, max(latitude) as max_lat,
           min(longitude) as min_lon, max(longitude) as max_lon
        FROM parcels 
        WHERE county = 'Saint Johns'
    `);
    
    fs.appendFileSync(logFile, '\n🌍 Spatial Bounds (St. Johns):\n');
    fs.appendFileSync(logFile, JSON.stringify(boundsRes.rows, null, 2) + '\n');
    
    const b = boundsRes.rows[0];
    if (b.min_lat > 29.0 && b.max_lat < 30.3 && b.min_lon > -82.0 && b.max_lon < -81.0) {
        fs.appendFileSync(logFile, '✅ Bounds fall correctly within North East Florida.\n');
    } else {
        fs.appendFileSync(logFile, '⚠️ Bounds look odd. Please verify visually.\n');
    }

    // 4. Sample Data
    fs.appendFileSync(logFile, '\n🔎 Sample Record:\n');
    const sample = await client.query(`
        SELECT parcelno, own_name, own_addr1, phy_addr1, acreage, jv 
        FROM parcels 
        WHERE county = 'Saint Johns' 
        LIMIT 1
    `);
    fs.appendFileSync(logFile, JSON.stringify(sample.rows, null, 2) + '\n');
    console.log('Verification Complete. Written to verify_log.txt');

  } catch (err) {
      console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

verifyFullLoad();
