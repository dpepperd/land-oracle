const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const res = await pool.query("SELECT parcel_id, parcelno, own_name, jv as market_value FROM parcels WHERE county = 'Brevard' LIMIT 5");
    console.log("Records:", res.rows);
    pool.end();
}
run();
