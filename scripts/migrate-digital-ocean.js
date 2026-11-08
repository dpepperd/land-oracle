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
    console.log('🏗️  Applying Digital Ocean Schema Migration...');

    await client.query('BEGIN');

    // 1. Users Table - Altering existing table from previous init
    console.log('   - Migrating users table...');
    // We need to match the new schema. 
    // Current: id, clerk_id, email, subscription_tier, subscription_status, stripe_customer_id, created_at, subscription_ends_at
    // New: id, email, password_hash, subscription_tier, subscription_status, trial_ends_at, trial_started_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at, clerk_id (preserved for Clerk)
    
    // Rename/Add columns
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    // Ensure defaults match (demo)
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN subscription_tier SET DEFAULT 'demo';
    `);

    // 2. Demo Sessions Table
    console.log('   - Creating table: demo_sessions');
    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        session_started TIMESTAMP DEFAULT NOW(),
        parcels_viewed INTEGER DEFAULT 0,
        export_attempts INTEGER DEFAULT 0,
        upgrade_clicks INTEGER DEFAULT 0
      );
    `);

    // 3. User County Access (Verify)
    console.log('   - Verifying user_county_access...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_county_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        county VARCHAR(100),
        granted_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, county)
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Migration successful!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
