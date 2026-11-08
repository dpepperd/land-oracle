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
        console.log('🔧 Standardizing St. Johns / St. Lucie...');
        
        // Fix St. Lucie -> Saint Lucie
        const res1 = await client.query("UPDATE parcels SET county = 'Saint Lucie' WHERE county ILIKE 'St%Lucie%' AND county != 'Saint Lucie'");
        console.log(`Updated ${res1.rowCount} records to 'Saint Lucie'.`);

        // Fix St. Johns -> Saint Johns
        const res2 = await client.query("UPDATE parcels SET county = 'Saint Johns' WHERE county ILIKE 'St%Johns%' AND county != 'Saint Johns'");
        console.log(`Updated ${res2.rowCount} records to 'Saint Johns'.`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
