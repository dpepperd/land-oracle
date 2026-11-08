const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use strict SSL config that works for this DB
// (Mirroring load-county.js config)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('Connecting to DB...');
  const client = await pool.connect();
  try {
    console.log('Reading migration script...');
    const sql = fs.readFileSync('add_county_column.sql', 'utf8');
    
    console.log('Executing migration...');
    await client.query(sql);
    
    console.log('✅ Migration successful! County column added and populated.');
    
    // Final verify
    const res = await client.query("SELECT county, COUNT(*) FROM parcels GROUP BY county");
    console.log('Verification Results:', res.rows);
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
