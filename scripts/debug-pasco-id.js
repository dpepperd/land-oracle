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
    console.log('🔍 Investigating Pasco IDs...');
    
    // 1. Search for the specific failing ID (exact or fuzzy)
    // The user's new URL had: 1526210030051000050
    const target = '1526210030051000050';
    console.log(`Checking for variations of: ${target}`);

    const res = await client.query(`
        SELECT gid, parcel_id, parcelno, own_name, phy_addr1
        FROM parcels 
        WHERE county = 'Pasco' 
          AND (
             replace(parcel_id, '-', '') ILIKE '%' || $1 || '%'
             OR 
             replace(parcelno, '-', '') ILIKE '%' || $1 || '%'
          )
    `, [target]);
    
    if (res.rows.length > 0) {
        console.log('✅ Found record in DB:');
        console.log(res.rows[0]);
    } else {
        console.log('❌ Record NOT found in DB using loose search.');
    }

    // 2. Get 3 random valid records to compare format
    console.log('\n📅 Sampling 3 random Pasco records:');
    const sample = await client.query(`
        SELECT parcel_id, parcelno 
        FROM parcels 
        WHERE county = 'Pasco' 
        LIMIT 3
    `);
    sample.rows.forEach(r => {
        console.log(`ID: ${r.parcel_id} | NO: ${r.parcelno}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
