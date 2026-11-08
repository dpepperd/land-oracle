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
    console.log('🔍 Analyzing Pasco ID Formats...');
    
    // 1. Check the "Working" ID from User
    // URL: 162521098A000001980
    const workingTarget = '162521098A000001980';
    console.log(`\n1. Searching for "Working" ID: ${workingTarget}`);
    const resWorking = await client.query(`
        SELECT parcelno, parcel_id 
        FROM parcels 
        WHERE county = 'Pasco' 
          AND replace(parcelno, '-', '') = $1
    `, [workingTarget]);

    if (resWorking.rows.length > 0) {
        console.log('✅ Found Working ID in DB:');
        console.log(resWorking.rows[0]);
    } else {
        console.log('❌ Working ID not found in DB directly.');
        // Try fuzzy
        const resFuzzy = await client.query(`
            SELECT parcelno, parcel_id 
            FROM parcels 
            WHERE county = 'Pasco' 
              AND replace(parcelno, '-', '') LIKE '162521%'
            LIMIT 1
        `);
        if (resFuzzy.rows.length > 0) console.log('Found similar:', resFuzzy.rows[0]);
    }

    // 2. Check the "Failing" ID
    // ID: 332516006000G000040
    const failingTarget = '332516006000G000040';
    console.log(`\n2. Re-Confirming "Failing" ID: ${failingTarget}`);
    const resFailing = await client.query(`
        SELECT parcelno, parcel_id 
        FROM parcels 
        WHERE county = 'Pasco' 
          AND replace(parcelno, '-', '') = $1
    `, [failingTarget]);

    if (resFailing.rows.length > 0) {
        console.log('✅ Found Failing ID in DB:');
        console.log(resFailing.rows[0]);
    } else {
        console.log('❌ Failing ID not found in DB directly.');
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
