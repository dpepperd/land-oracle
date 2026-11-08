const { Client } = require('pg');
require('dotenv').config();

// Try without SSL first, as local DBs often don't have it.
// If DATABASE_URL has ?sslmode=... it might override.
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false, 
  connectionTimeoutMillis: 5000
});

async function check() {
  try {
    console.log('Connecting (no SSL)...');
    await client.connect();
    console.log('Connected.');
    
    const countRes = await client.query(`SELECT count(*) FROM parcels WHERE county = 'Miami-Dade'`);
    console.log('Count:', countRes.rows[0].count);

    const res = await client.query(`
      SELECT dor_code, count(*) as cnt 
      FROM parcels 
      WHERE county = 'Miami-Dade' 
      GROUP BY dor_code 
      ORDER BY cnt DESC 
      LIMIT 20
    `);
    
    console.log('DOR Codes:', res.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
