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
    console.log('🏗️  Adding trial_ends_at column...');

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
    `);

    console.log('✅ Success! Column added.');

  } catch (err) {
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
