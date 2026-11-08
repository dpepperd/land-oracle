
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const client = await pool.connect();
  try {
    console.log('--- Schema ---');
    const schema = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parcels'
    `);
    schema.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

    console.log('\n--- Content ---');
    const res = await client.query(`
      SELECT parcel_id, parcelno 
      FROM parcels 
      WHERE county = 'Palm Beach' 
      LIMIT 1
    `);
    console.log(res.rows[0]);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

inspect();
