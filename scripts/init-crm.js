require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Initializing CRM tables...");
    
    // Create Note Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_parcel_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        parcel_id TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Index for quick lookup
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_parcel 
        ON user_parcel_notes(user_id, parcel_id);
    `);

    console.log("✅ user_parcel_notes table created/verified.");
    
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
