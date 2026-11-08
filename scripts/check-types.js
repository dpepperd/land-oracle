const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking `parcels` column types...');
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'parcels'
        AND column_name IN ('own_zipcd', 'latitude', 'longitude', 'jv', 'av_sd', 'acreage');
    `);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
