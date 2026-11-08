const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// FORCE bypass SSL check (Safe for dev/repair scripts)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function repairDatabase() {
  const client = await pool.connect();
  try {
    console.log("🛠️ Starting Database Repair...");

    // 1. Create Tables
    const schemaSQL = `
      -- USERS
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          clerk_id VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user',
          subscription_tier VARCHAR(50) DEFAULT 'free',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- LEADS
      CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          parcel_id VARCHAR(255) NOT NULL,
          user_id INTEGER REFERENCES users(id),
          status VARCHAR(50) DEFAULT 'new',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(parcel_id, user_id)
      );

      -- NOTES
      CREATE TABLE IF NOT EXISTS user_parcel_notes (
          id SERIAL PRIMARY KEY,
          parcel_id VARCHAR(255) NOT NULL,
          user_id INTEGER REFERENCES users(id),
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- HIGHWAYS
      CREATE TABLE IF NOT EXISTS highways (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          type VARCHAR(50),
          geojson JSONB
      );
    `;

    await client.query(schemaSQL);
    console.log("✅ Tables Created (Users, Leads, Notes, Highways)");

    // 2. Restore Admin Access
    // We update ALL users to admin since this is a dev environment
    const updateResult = await client.query(`
        UPDATE users 
        SET role = 'admin', subscription_tier = 'premium'
        WHERE role IS DISTINCT FROM 'admin';
    `);
    console.log(`👑 Admin Access Restored for ${updateResult.rowCount} users.`);

  } catch (err) {
    console.error("❌ Repair Failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

repairDatabase();
