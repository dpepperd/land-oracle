const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔍 Inspecting Pasco Land Use Codes (dor_uc)...');

    const res = await client.query(`
        SELECT dor_uc, count(*) as count 
        FROM parcels 
        WHERE county = 'Pasco'
        GROUP BY dor_uc
        ORDER BY count DESC
        LIMIT 20
    `);

    console.table(res.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
