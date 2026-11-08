const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Adding alt_key column to parcels table...');
    
    await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS alt_key TEXT;
    `);
    
    // Create an index for it too, just in case we search by it
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parcels_alt_key ON parcels(alt_key);
    `);

    console.log('✅ Schema Updated.');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
