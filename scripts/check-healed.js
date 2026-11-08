require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const counties = ['Hamilton', 'Madison', 'Gilchrist', 'Liberty', 'Jackson', 'Jefferson', 'Bay', 'Walton', 'Union'];

async function run() {
  for (const c of counties) {
    const res = await pool.query("SELECT count(*) FROM parcels WHERE county = $1", [c]);
    console.log(`${c.padEnd(12)}: DB Count = ${res.rows[0].count}`);
  }
  process.exit(0);
}

run();
