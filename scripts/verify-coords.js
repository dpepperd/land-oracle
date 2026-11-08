const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCoords() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking St. Johns Coordinates...');
    const res = await client.query(`
        SELECT parcel_id, own_addr1, latitude, longitude 
        FROM parcels 
        WHERE county = 'Saint Johns' 
        LIMIT 5;
    `);
    
    if (res.rows.length === 0) {
        console.log('❌ No records found for Saint Johns.');
    } else {
        console.table(res.rows);
        
        // Sanity Check
        const sample = res.rows[0];
        const lat = parseFloat(sample.latitude);
        const lon = parseFloat(sample.longitude);
        
        console.log('\n📐 Sanity Check:');
        console.log(`   Lat: ${lat} (Expected ~29.5 to 30.2)`);
        console.log(`   Lon: ${lon} (Expected ~-81.7 to -81.3)`);
        
        if (lat > 29 && lat < 31 && lon > -82 && lon < -81) {
            console.log('✅ Coordinates look valid for St. Johns County!');
        } else {
            console.warn('⚠️ Coordinates look suspicious! Check projection.');
        }
    }
    
  } catch (err) {
      console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkCoords();
