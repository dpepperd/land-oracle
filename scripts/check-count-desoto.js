const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking counts for all variations of "Desoto"...');
    
    const res = await client.query(`
      SELECT county, count(*) 
      FROM parcels 
      WHERE county ILIKE '%soto%'
      GROUP BY county
    `);
    
    console.table(res.rows);
    
    if (res.rows.length === 0) {
        console.log('❌ No records found for *soto*.');
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
