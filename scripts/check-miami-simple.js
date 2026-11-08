const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

async function check() {
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected.');
    
    // Check Prop Use Distribution
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
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
