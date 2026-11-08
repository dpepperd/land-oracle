
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT email, role, subscription_tier FROM users ORDER BY created_at DESC LIMIT 5");
        console.log("--- Users ---");
        res.rows.forEach(r => console.log(`${r.email} | ${r.role} | ${r.subscription_tier}`));
    } catch(e) { console.error(e); } finally { pool.end(); }
}
main();
