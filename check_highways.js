const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking highways table...');
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'highways'");
    
    if (res.rows.length === 0) {
      console.log('TABLE highways DOES NOT EXIST.');
    } else {
      console.table(res.rows);
      const count = await client.query('SELECT COUNT(*) FROM highways');
      console.log('Row count:', count.rows[0].count);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

check();
