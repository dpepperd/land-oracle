const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/migrate-jv.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating jv (Market Value) to NUMERIC...');
    
    // 1. Clean data and cast
    // Using the same logic as the search API: remove non-numeric chars
    await client.query(`
        ALTER TABLE parcels 
        ALTER COLUMN jv TYPE NUMERIC 
        USING CAST(NULLIF(REGEXP_REPLACE(COALESCE(jv, '0'), '[^0-9.]', '', 'g'), '') AS NUMERIC)
    `);
    
    console.log('✅ Column type updated.');

    // 2. Add Index
    console.log('Adding index on jv...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_parcels_jv ON parcels(jv)');
    console.log('✅ Index created.');

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
