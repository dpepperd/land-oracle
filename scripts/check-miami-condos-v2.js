const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000, // 5s timeout
});

async function checkMiamiCondos() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Miami-Dade Condo Data ---');
    
    // Check Total Count
    const countRes = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Miami-Dade'`);
    console.log('Total Records:', countRes.rows[0].count);

    // Check Condo Count (DOR 04)
    const condoRes = await client.query(`
      SELECT dor_code, count(*) 
      FROM parcels 
      WHERE county = 'Miami-Dade' 
      GROUP BY dor_code 
      ORDER BY count(*) DESC
      LIMIT 20
    `);

    console.log('DOR Code Distribution:');
    condoRes.rows.forEach(r => console.log(`${r.dor_code}: ${r.count}`));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkMiamiCondos();
