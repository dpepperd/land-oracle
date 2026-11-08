const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function list() {
  const client = await pool.connect();
  try {
    console.log('🔍 Listing All Users:');
    const res = await client.query(`SELECT id, email, clerk_id, role, subscription_tier FROM users`);
    if (res.rows.length === 0) {
        console.log('❌ No users found in database.');
    } else {
        console.table(res.rows);
    }
  } finally {
    client.release();
    pool.end();
  }
}

list();
