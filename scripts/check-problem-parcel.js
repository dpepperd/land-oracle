// scripts/check-problem-parcel.js
require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkParcel() {
  // Try both formats
  const result1 = await pool.query(
    "SELECT * FROM parcels WHERE parcel_id = $1",
    ['052S2100000000012']
  );
  
  const result2 = await pool.query(
    "SELECT * FROM parcels WHERE parcel_id LIKE $1",
    ['%052S21%00012%']
  );
  
  console.log('\n🔍 Searching for problem parcel...\n');
  
  if (result1.rows.length > 0) {
    const p = result1.rows[0];
    console.log('✓ Found parcel: 052S2100000000012');
    console.log('='.repeat(70));
    console.log(`Coordinates: ${p.latitude}, ${p.longitude}`);
    console.log(`Owner: ${p.owner_name}`);
    console.log(`Acres: ${p.acreage}`);
    console.log(`Property Address: ${p.property_address}`);
    console.log('='.repeat(70));
    console.log(`\n🗺️  Google Maps: https://www.google.com/maps?q=${p.latitude},${p.longitude}`);
    console.log(`📍 Expected Location: Near Noble Grocery Rd, Glen St Mary\n`);
  } else {
    console.log('❌ Parcel not found with ID: 052S2100000000012');
  }
  
  if (result2.rows.length > 0) {
    console.log(`\n✓ Found ${result2.rows.length} similar parcels`);
    result2.rows.forEach(p => {
      console.log(`  - ${p.parcel_id}: ${p.latitude}, ${p.longitude}`);
    });
  }
  
  await pool.end();
}

checkParcel().catch(console.error);