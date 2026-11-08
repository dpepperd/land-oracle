// scripts/check-version.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkVersion() {
  try {
    const result = await pool.query('SELECT version();');
    console.log('\n📊 PostgreSQL Version:');
    console.log(result.rows[0].version);
    
    // Also check what extensions are available
    const extensions = await pool.query("SELECT * FROM pg_available_extensions WHERE name LIKE '%postgis%';");
    console.log('\n📦 PostGIS Extensions Available:');
    if (extensions.rows.length > 0) {
      console.table(extensions.rows);
    } else {
      console.log('No PostGIS extensions found');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkVersion();