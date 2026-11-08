const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Explicitly disable SSL for local checking
});

async function debug() {
  const client = await pool.connect();
  try {
    // Check Counties
    console.log('--- Counties ---');
    const res = await client.query('SELECT DISTINCT county, count(*) FROM parcels GROUP BY county');
    res.rows.forEach(r => console.log(`${r.county}: ${r.count}`));
    
    // Check Indexes
    console.log('\n--- Indexes ---');
    const idxRes = await client.query("SELECT * FROM pg_indexes WHERE tablename = 'parcels'");
    idxRes.rows.forEach(r => console.log(r.indexdef));
    
    // Check constraints
    console.log('\n--- Constraints ---');
    const conRes = await client.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'parcels'::regclass");
    conRes.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

debug();
