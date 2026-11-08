const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    const tables = ['parcels', 'leads', 'users', 'user_parcel_notes'];
    
    for (const table of tables) {
      console.log(`\n=== TABLE: ${table} ===`);
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      res.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

checkSchema();
