const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking "geom" column type...');
    const res = await client.query(`
        SELECT column_name, udt_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'parcels' AND column_name = 'geom';
    `);
    console.table(res.rows);
    
    // Check constraints if any
    const con = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE conrelid = 'parcels'::regclass;
    `);
    console.log('\nConstraints:');
    con.rows.forEach(r => console.log(r.conname, ':', r.pg_get_constraintdef));

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
