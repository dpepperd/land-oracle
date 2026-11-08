const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const tables = ['parcels', 'leads', 'user_parcel_notes', 'users'];
    for (const table of tables) {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY column_name`, [table]);
        console.log(`\n=== TABLE: ${table} ===`);
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
