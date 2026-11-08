// scripts/check-land-use.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkLandUse() {
  // Get all unique land use codes
  const result = await pool.query(`
    SELECT 
      land_use,
      COUNT(*) as count,
      county
    FROM parcels
    WHERE land_use IS NOT NULL
    GROUP BY land_use, county
    ORDER BY county, count DESC
    LIMIT 50;
  `);
  
  console.log('\n📊 Land Use Codes by County:');
  console.table(result.rows);
  
  // Get totals
  const totals = await pool.query(`
    SELECT 
      COUNT(*) as total_parcels,
      COUNT(land_use) as parcels_with_land_use,
      COUNT(CASE WHEN land_use IS NULL THEN 1 END) as parcels_without_land_use
    FROM parcels;
  `);
  
  console.log('\n📈 Summary:');
  console.table(totals.rows);
  
  await pool.end();
}

checkLandUse();