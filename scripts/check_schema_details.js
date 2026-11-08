const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('--- Parcels Columns ---');
    const parcels = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'parcels'
        ORDER BY column_name;
    `);
    console.table(parcels.rows.map(r => ({ col: r.column_name, type: r.data_type })));

    console.log('--- Leads Columns ---');
    const leads = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'leads'
        ORDER BY column_name;
    `);
    console.table(leads.rows.map(r => ({ col: r.column_name, type: r.data_type })));

    console.log('--- User Parcel Notes Columns ---');
    const notes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_parcel_notes'
        ORDER BY column_name;
    `);
    console.table(notes.rows.map(r => ({ col: r.column_name, type: r.data_type })));

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
