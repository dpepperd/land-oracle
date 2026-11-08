const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const res = await pool.query("SELECT count(*) FROM parcels WHERE county = 'Leon'");
    console.log('Leon Count:', res.rows[0].count);
    pool.end();
}
run();
