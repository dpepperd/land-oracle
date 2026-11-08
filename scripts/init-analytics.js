
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initAnalytics() {
  const client = await pool.connect();
  try {
    console.log('🚧 Creating demo_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_started TIMESTAMP DEFAULT NOW(),
        parcels_viewed INTEGER DEFAULT 0,
        export_attempts INTEGER DEFAULT 0,
        upgrade_clicks INTEGER DEFAULT 0
      );
    `);
    console.log('✅ Table created.');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

initAnalytics();
