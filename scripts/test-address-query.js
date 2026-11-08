const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/test-address-query.js

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
});

async function test() {
    const client = await pool.connect();
    try {
        const searchTerm = '%Main%';
        console.log(`Testing query for address containing "${searchTerm}"...`);

        const res = await client.query(`
            SELECT parcelno, own_addr1, phy_addr1, county 
            FROM parcels 
            WHERE (phy_addr1 ILIKE $1 OR own_addr1 ILIKE $1)
            LIMIT 5
        `, [searchTerm]);

        console.log(`Found ${res.rows.length} records.`);
        res.rows.forEach(r => {
            console.log(`- [${r.county}] ${r.parcelno}: ${r.phy_addr1} (Own: ${r.own_addr1})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

test();
