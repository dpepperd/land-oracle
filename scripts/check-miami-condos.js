const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMiamiCondos() {
  const client = await pool.connect();
  try {
    console.log('--- Checking Miami-Dade Condo Data ---');
    
    // Check Total Count
    const countRes = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Miami-Dade'`);
    console.log('Total Records:', countRes.rows[0].count);

    // Check Condo Count (DOR 04)
    // Note: DOR codes might be strings '04' or numbers 4.
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
    
    // Check for "Condo" in land_use_desc or similar if dor_code is missing
    // Assuming land_use or prop_use column exists from previous schema knowledge
    // But dor_code is standard.

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkMiamiCondos();
