const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Applying Admin V2 Schema Migration...');

    await client.query('BEGIN');

    // 1. Parcels Table - Add new columns
    console.log('   - Adding email and verification fields to parcels table...');
    await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration successful!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
