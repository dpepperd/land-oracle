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
        console.log('🕵️‍♂️ Diagnosing Collision for ID: 1729900000');
        
        // 1. Who owns this ID?
        const res = await client.query("SELECT county, parcel_id, own_name FROM parcels WHERE parcel_id = '1729900000'");
        if (res.rows.length > 0) {
            console.log('❌ ID EXISTS in DB:');
            console.table(res.rows);
        } else {
            console.log('✅ ID does NOT exist (WEIRD - why did insert fail?)');
        }

        // 2. Check Constraints
        console.log('\n📜 Checking Constraints on `parcels`:');
        const constraints = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'parcels'::regclass
        `);
        console.table(constraints.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
