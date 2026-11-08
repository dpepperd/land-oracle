const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('💰 Enriching Sarasota sample data...');
    
    // Set realistic values for visibility
    const query = `
        UPDATE parcels 
        SET jv = 250000, acreage = 0.25
        WHERE county = 'Sarasota' AND (jv = 0 OR jv IS NULL)
    `;
    
    const res = await client.query(query);
    console.log(`✅ Updated ${res.rowCount} records with dummy value/acreage.`);
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
