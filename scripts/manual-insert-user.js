const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CLERK_ID = 'user_38dA0WIWYCWUH2RJ0lXwt80ZZvT';
const EMAIL = 'dpepperd@gmail.com'; // Assuming Dirk, can be updated later

async function insertUser() {
  const client = await pool.connect();
  try {
    console.log(`👤 Inserting User: ${CLERK_ID} (${EMAIL})...`);

    // Insert or Update
    // Granting 'enterprise' tier and 'admin' role immediately
    // Also setting 'beta_access' to TRUE since we have the guard on
    const res = await client.query(`
      INSERT INTO users (clerk_id, email, role, subscription_tier, beta_access, subscription_status)
      VALUES ($1, $2, 'admin', 'enterprise', TRUE, 'active')
      ON CONFLICT (clerk_id) 
      DO UPDATE SET 
        role = 'admin',
        subscription_tier = 'enterprise',
        beta_access = TRUE,
        email = $2
      RETURNING *;
    `, [CLERK_ID, EMAIL]);

    console.log('✅ Success! User record active:', res.rows[0]);

  } catch (err) {
    console.error('❌ Error inserting user:', err);
  } finally {
    client.release();
    pool.end();
  }
}

insertUser();
