require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Attempting to drop constraint/index 'idx_notes_user_parcel'...");
    
    // Try dropping as constraint
    try {
        await client.query(`ALTER TABLE user_parcel_notes DROP CONSTRAINT IF EXISTS idx_notes_user_parcel;`);
        console.log("Dropped constraint (if existed).");
    } catch (e) {
        console.log("Constraint drop warning:", e.message);
    }

    // Try dropping as index
    try {
        await client.query(`DROP INDEX IF EXISTS idx_notes_user_parcel;`);
        console.log("Dropped index (if existed).");
    } catch (e) {
        console.log("Index drop warning:", e.message);
    }
    
    console.log("Done.");
  } catch (err) {
    console.error("General failure:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
