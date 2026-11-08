require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const county = process.argv[2];

if (!county) {
  console.log('Usage: node delete-county.js <CountyName>');
  process.exit(1);
}

pool.query('DELETE FROM parcels WHERE county = $1', [county])
  .then(result => {
    console.log(`✅ Deleted ${result.rowCount} records from ${county}`);
    pool.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    pool.end();
  });