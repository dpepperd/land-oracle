
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const county = process.argv[2];
if (!county) {
    console.log("Usage: node scripts/check-count.js <Doing>");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query("SELECT COUNT(1) as count FROM parcels WHERE county = $1", [county]);
        console.log(`Region: ${county}`);
        console.log(`Count: ${res.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
