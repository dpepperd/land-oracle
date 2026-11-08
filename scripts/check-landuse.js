const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkLandUse() {
  const client = await pool.connect();
  try {
    console.log('Checking distinct land_use for Baker county...');
    const res = await client.query(`
      SELECT DISTINCT land_use 
      FROM parcels 
      WHERE county = 'Baker' 
      ORDER BY land_use 
      LIMIT 20
    `);
    
    console.log('Distinct Land Use Codes:', res.rows.map(r => r.land_use));

    console.log('Checking count of 3-digit vs 2-digit codes...');
    const countRes = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE length(land_use) = 3) as len_3,
        COUNT(*) FILTER (WHERE length(land_use) = 2) as len_2,
        COUNT(*) as total
      FROM parcels 
      WHERE county = 'Baker'
    `);
    console.log('Counts:', countRes.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkLandUse();
