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
        console.log('Checking Leon Count...');
        const res = await client.query("SELECT count(*) FROM parcels WHERE county = 'Leon'");
        console.log(`Leon Records: ${parseInt(res.rows[0].count).toLocaleString()}`);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
