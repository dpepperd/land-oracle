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
    const email = 'dpepperd@gmail.com';
    console.log(`🎁 Granting Sumter Access to ${email}...`);
    
    const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
        console.error('User not found!');
        return;
    }
    const userId = userRes.rows[0].id;

    await client.query(`
        INSERT INTO user_county_access (user_id, county)
        VALUES ($1, 'Sumter')
        ON CONFLICT (user_id, county) DO NOTHING
    `, [userId]);

    console.log('✅ Access Granted.');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
