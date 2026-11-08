const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixStLucie() {
  try {
    const client = await pool.connect();
    
    console.log('Running Update: Saint Lucie -> St. Lucie');
    const result = await client.query("UPDATE parcels SET county = 'St. Lucie' WHERE county = 'Saint Lucie'");
    console.log(`Updated ${result.rowCount} records.`);

    client.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixStLucie();
