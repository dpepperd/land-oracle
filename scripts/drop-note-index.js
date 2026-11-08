require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // Drop the unique index to allow history/multiple notes
    console.log("Dropping unique index 'idx_user_parcel_notes_unique'...");
    await client.query(`DROP INDEX IF EXISTS idx_user_parcel_notes_unique;`);
    console.log("Done.");
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
