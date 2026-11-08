const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adding missing columns to parcels table...');
    
    await client.query(`
      ALTER TABLE parcels
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);

    console.log('✅ Columns added successfully.');
    
  } catch (e) {
    console.error('Error adding columns:', e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
