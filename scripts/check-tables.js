const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('highways', 'traffic_stats')
    `);
    console.log('Found tables:', res.rows.map(r => r.table_name));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

checkTables();
