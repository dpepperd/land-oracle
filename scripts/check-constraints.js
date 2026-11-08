const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Checking constraints on parcels table...');
  try {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'parcels'::regclass
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Check index uniqueness too
    const idx = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'parcels'
    `);
    console.log(JSON.stringify(idx.rows, null, 2));
    
  } catch(e) { console.error(e); }
  pool.end();
}
run();
