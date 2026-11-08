require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Checking notes for parcel 011N19000000000010...");
    
    // Check if ANY notes exist for this parcel
    const res = await client.query(`
      SELECT n.*, u.email, u.role 
      FROM user_parcel_notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.parcel_id = '011N19000000000010'
    `);
    
    console.log("Count:", res.rowCount);
    console.log("Notes:", JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
