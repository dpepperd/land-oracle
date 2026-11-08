const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'highways'", (err, res) => {
  if (err) {
    console.error(err);
  } else {
    console.log(res.rows.map(r => r.column_name));
  }
  pool.end();
});
