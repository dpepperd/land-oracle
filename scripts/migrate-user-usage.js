const { Pool } = require('pg');
const path = require('path');
// Bypass SSL validation for dev/migration scripts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    requestCert: false
  }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Migrating User Usage Tables...');

    // 1. Daily Search Usage
    // Logs count per user per day. Reset logic will be handled by application/cron (or just query by date).
    console.log('   - Creating table: user_usage_searches');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_usage_searches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        count INTEGER DEFAULT 0,
        UNIQUE(user_id, date)
      );
    `);

    // 2. Export Usage
    // Tracks lifetime metrics and monthly quotas.
    console.log('   - Creating table: user_usage_exports');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_usage_exports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lifetime_count INTEGER DEFAULT 0,
        monthly_count INTEGER DEFAULT 0,
        last_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    
    // 3. Add 'trial_start_date' to users if not exists
    console.log('   - Checking users table for trial columns');
    await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50) DEFAULT 'none'; -- 'active', 'expired', 'converted'
    `);

    console.log('✅ Success! Tables migrated.');

  } catch (err) {
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
