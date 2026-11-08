const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const connString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('?sslmode=require', '').replace('&sslmode=require', '')
  : undefined;

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false }
});

async function checkDuval() {
  const client = await pool.connect();
  try {
    console.log('Checking parcels table columns...');
    
    console.log('Checking for missing owner data...');
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(own_name) as has_owner_name,
        COUNT(own_addr1) as has_owner_address
      FROM parcels 
      WHERE county ILIKE 'Duval'
    `);
    
    console.log('Owner Data Status:', JSON.stringify(result.rows[0]));



  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

checkDuval().then(() => {
    console.log('Script finished, exiting...');
    process.exit(0);
});

// Force exit after 10 seconds to prevent freezing
setTimeout(() => {
    console.error('Timeout reached, forcing exit');
    process.exit(1);
}, 10000);
