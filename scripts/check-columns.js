const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking `users` table columns...');
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users';
    `);
    console.table(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}

checkColumns();
