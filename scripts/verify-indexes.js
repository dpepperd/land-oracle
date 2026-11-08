const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function checkIndex() {
  try {
    const res = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'flood_hazard'");
    console.log('Indexes found:', res.rows.length);
    res.rows.forEach(r => console.log(`- ${r.indexname}`));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
checkIndex();
