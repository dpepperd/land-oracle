
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugSearch() {
  const client = await pool.connect();
  try {
    console.log('--- 1. Inspect Full Record ---');
    const fullRes = await client.query(`SELECT * FROM parcels WHERE county = 'Palm Beach' LIMIT 1`);
    console.log(fullRes.rows[0]);

    console.log('\n--- 2. Simulate Search Query ---');
    // Using simple query mimicking route.ts
    const sql = `
      SELECT p.parcelno, p.county, p.own_name
      FROM parcels p
      WHERE p.county = 'Palm Beach'
      AND (p.own_state = 'FL' OR p.own_state IS NULL) 
      LIMIT 5
    `;
    const searchRes = await client.query(sql);
    console.log(`Simple Search Result Count: ${searchRes.rows.length}`);

    console.log('\n--- 3. Check Entitlements (User Access) ---');
    const userRes = await client.query(`SELECT id, email, role FROM users WHERE email = 'dpepperd@gmail.com'`);
    const user = userRes.rows[0];
    console.log('User:', user);

    if (user) {
        const accessRes = await client.query(`SELECT * FROM user_county_access WHERE user_id = $1 AND county = 'Palm Beach'`, [user.id]);
        console.log('Access Record:', accessRes.rows);
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

debugSearch();
