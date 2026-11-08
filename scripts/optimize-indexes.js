const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function optimize() {
  const client = await pool.connect();
  try {
    console.log('Creating index on jv...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_parcels_jv ON parcels(jv)');
    console.log('✅ Index idx_parcels_jv created.');

    console.log('Creating index on acreage...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_parcels_acreage ON parcels(acreage)');
    console.log('✅ Index idx_parcels_acreage created.');
    
    // Also create compound index for county + jv which is common
    console.log('Creating index on county + jv...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_parcels_county_jv ON parcels(county, jv)');
    console.log('✅ Index idx_parcels_county_jv created.');

  } catch (e) {
    console.error('Optimization failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

optimize();
