const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('📊 Fetching Distinct Counties...');
        const res = await client.query('SELECT county, COUNT(*) as cnt FROM parcels GROUP BY county ORDER BY county');
        
        console.log('County'.padEnd(30) + 'Count');
        console.log('-'.repeat(40));
        res.rows.forEach(r => {
            console.log(r.county.padEnd(30) + r.cnt);
        });
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
