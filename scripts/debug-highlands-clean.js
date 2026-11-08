const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debug() {
    const client = await pool.connect();
    try {
        const countRes = await client.query(`SELECT COUNT(*) FROM parcels WHERE county = 'Highlands';`);
        console.log('--- DB COUNT CHECK ---');
        console.log(`HIGHLANDS PARCELS: ${countRes.rows[0].count}`);
        console.log('----------------------');

        const res = await client.query(`
            SELECT parcel_id, own_name FROM parcels 
            WHERE county = 'Highlands' 
            LIMIT 3;
        `);
        console.log('Sample Names:', res.rows.map(r => r.own_name));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

debug();
