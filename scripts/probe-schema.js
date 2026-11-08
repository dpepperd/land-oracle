const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.split('?')[0],
  ssl: { rejectUnauthorized: false }
});

async function main() {
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'parcels'
        AND (
            column_name LIKE '%val%' OR 
            column_name LIKE '%geo%' OR 
            column_name LIKE '%lat%' OR 
            column_name LIKE '%lon%' OR
            column_name LIKE '%addr%'
        )
    `);
    console.table(res.rows);
    await pool.end();
}

main().catch(console.error);
