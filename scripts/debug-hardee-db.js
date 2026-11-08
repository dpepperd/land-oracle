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
        const res = await client.query(`
            SELECT parcel_id, parcelno, own_name, own_zipcd, dor_uc, 
                   ST_AsText(geom) as wkt
            FROM parcels 
            WHERE county = 'Hardee' 
            LIMIT 5;
        `);
        console.log('Hardee Sample Records:', res.rows);
        
        const countRes = await client.query(`SELECT COUNT(*) FROM parcels WHERE county = 'Hardee';`);
        console.log('Total Count:', countRes.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

debug();
