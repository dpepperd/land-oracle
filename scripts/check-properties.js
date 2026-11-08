// scripts/check-properties.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProperties() {
  // Check properties table structure
  const columns = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'properties'
    ORDER BY ordinal_position;
  `);
  
  console.log('\n📋 Properties table columns:');
  console.table(columns.rows);
  
  // Check what's in there
  const data = await pool.query('SELECT * FROM properties LIMIT 5;');
  console.log('\n📊 Sample properties data:');
  console.table(data.rows);
  
  // Check if counties are in properties
  const counties = await pool.query('SELECT DISTINCT county, COUNT(*) as count FROM properties GROUP BY county;');
  console.log('\n📍 Counties in properties table:');
  console.table(counties.rows);
  
  await pool.end();
}

checkProperties();