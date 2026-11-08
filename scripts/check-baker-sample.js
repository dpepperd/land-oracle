// scripts/check-baker-sample.js
require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSample() {
  console.log('🔍 Checking Baker County Data\n');
  
  // Get basic stats
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      MIN(latitude) as min_lat,
      MAX(latitude) as max_lat,
      MIN(longitude) as min_lon,
      MAX(longitude) as max_lon,
      AVG(latitude) as avg_lat,
      AVG(longitude) as avg_lon
    FROM parcels 
    WHERE county = 'Baker'
  `);
  
  const s = stats.rows[0];
  
  console.log('📊 OVERVIEW');
  console.log('='.repeat(70));
  console.log(`Total Parcels: ${s.total}`);
  console.log(`Latitude Range: ${parseFloat(s.min_lat).toFixed(4)} to ${parseFloat(s.max_lat).toFixed(4)}`);
  console.log(`Longitude Range: ${parseFloat(s.min_lon).toFixed(4)} to ${parseFloat(s.max_lon).toFixed(4)}`);
  console.log(`Center Point: ${parseFloat(s.avg_lat).toFixed(4)}, ${parseFloat(s.avg_lon).toFixed(4)}`);
  console.log('='.repeat(70));
  
  // Get 3 specific parcels to test
  const parcels = await pool.query(`
    SELECT 
      parcel_id,
      latitude,
      longitude,
      owner_name,
      owner_city,
      owner_state,
      property_address,
      acreage
    FROM parcels 
    WHERE county = 'Baker' AND latitude IS NOT NULL
    ORDER BY parcel_id
    LIMIT 3
  `);
  
  console.log('\n📍 SAMPLE PARCELS TO VERIFY\n');
  
  parcels.rows.forEach((p, i) => {
    console.log(`PARCEL ${i + 1}:`);
    console.log('─'.repeat(70));
    console.log(`Parcel ID: ${p.parcel_id}`);
    console.log(`Coordinates: ${p.latitude}, ${p.longitude}`);
    console.log(`Owner: ${p.owner_name || 'N/A'}`);
    console.log(`Owner Location: ${p.owner_city || 'N/A'}, ${p.owner_state || 'N/A'}`);
    console.log(`Property Address: ${p.property_address || 'N/A'}`);
    console.log(`Acreage: ${p.acreage || 'N/A'}`);
    console.log(`\n🗺️  Google Maps: https://www.google.com/maps?q=${p.latitude},${p.longitude}`);
    console.log(`🏛️  Property Appraiser: https://qpublic.schneidercorp.com/Application.aspx?AppID=1043&LayerID=22494&PageTypeID=4&PageID=9525`);
    console.log(`    (Search for parcel: ${p.parcel_id})\n`);
  });
  
  await pool.end();
}

checkSample().catch(console.error);