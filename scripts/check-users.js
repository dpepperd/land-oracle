const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking Users...');
    const res = await client.query(`
        SELECT id, email, clerk_id, role, subscription_tier, beta_access 
        FROM users 
        WHERE email = ANY($1::text[]);
    `, [(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)]);
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

check();
