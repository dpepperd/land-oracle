const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function grant() {
  const client = await pool.connect();
  try {
    console.log('🔓 Granting Sarasota access...');
    
    // Get existing users
    const users = await client.query('SELECT DISTINCT user_id FROM user_county_access');
    const userIds = users.rows.map(r => r.user_id);
    
    console.log('Found Users:', userIds);
    
    for (const uid of userIds) {
        await client.query(`
            INSERT INTO user_county_access (user_id, county)
            VALUES ($1, 'Sarasota')
            ON CONFLICT DO NOTHING
        `, [uid]);
        console.log(`✅ Granted Sarasota to User ${uid}`);
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

grant();
