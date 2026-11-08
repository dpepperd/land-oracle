const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Adding missing columns to parcels table...');

    await client.query(`
      ALTER TABLE parcels
      ADD COLUMN IF NOT EXISTS latitude NUMERIC,
      ADD COLUMN IF NOT EXISTS longitude NUMERIC,
      ADD COLUMN IF NOT EXISTS geojson TEXT,
      ADD COLUMN IF NOT EXISTS out_of_state BOOLEAN DEFAULT FALSE;
    `);
    
    // Also ensuring owner_name/address map correctly. 
    // The DB has 'own_name', 'own_addr1'. 
    // The Script tries to insert into 'owner_name', 'owner_address'.
    // I should create aliases or columns?
    // Actually, duplication is bad. I should UPDATE THE SCRIPT to use the existing DB column names.
    // Adding 'latitude/longitude' is fine as new features.
    // But duplicating 'owner_name' vs 'own_name' is messy.
    
    console.log('✅ Success! Columns added.');

  } catch (err) {
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
