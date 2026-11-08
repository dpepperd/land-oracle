// scripts/init-pricing-db.js
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Initializing Pricing & Access Control Tables...');

    // 1. Users Table
    // Added clerk_id for auth sync
    console.log('   - Creating table: users');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        subscription_tier VARCHAR(50) DEFAULT 'free', -- 'local', 'regional', 'statewide', 'enterprise'
        subscription_status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'cancelled', 'past_due'
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_ends_at TIMESTAMP
      );
    `);

    // 2. User County Access Table
    console.log('   - Creating table: user_county_access');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_county_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        county VARCHAR(100),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, county)
      );
    `);

    console.log('✅ Success! Tables created.');

    // 3. Verify
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'user_county_access');
    `);
    console.log('🔎 Verification - Tables found:', res.rows.map(r => r.table_name));

  } catch (err) {
    console.error('❌ Error initializing DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

initDB();
