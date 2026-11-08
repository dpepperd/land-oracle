// scripts/check-baker-status.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkBaker() {
  const result = await pool.query(`
    SELECT county, COUNT(*) as count 
    FROM parcels 
    GROUP BY county 
    ORDER BY count DESC;
  `);
  
  console.log('\n📊 Current parcels in database:');
  console.table(result.rows);
  
  await pool.end();
}

checkBaker();