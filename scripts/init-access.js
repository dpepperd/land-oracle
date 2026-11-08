
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initAccess() {
  const client = await pool.connect();
  try {
    console.log('🚧 Creating user_county_access table...');
    await client.query('DROP TABLE IF EXISTS user_county_access'); // Reset
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_county_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL, 
        county TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, county)
      );
    `);
    console.log('✅ Table created.');

    console.log('🔍 Finding users...');
    const users = await client.query('SELECT id, email FROM users');
    console.log(`Found ${users.rows.length} users.`);

    for (const user of users.rows) {
        console.log(`🔓 Granting Palm Beach access to ${user.email}...`);
        await client.query(`
            INSERT INTO user_county_access (user_id, county)
            VALUES ($1, 'Palm Beach')
            ON CONFLICT (user_id, county) DO NOTHING
        `, [user.id]);
    }
    console.log('✅ Access granted to all users.');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

initAccess();
