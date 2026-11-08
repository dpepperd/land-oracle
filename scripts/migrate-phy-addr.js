const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating phy_addr1 to VARCHAR(255)...');
    await client.query("ALTER TABLE parcels ALTER COLUMN phy_addr1 TYPE VARCHAR(255)");
    console.log('✅ Migration successful.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
