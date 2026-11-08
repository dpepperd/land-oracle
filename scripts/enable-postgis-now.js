// scripts/enable-postgis-now.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function enablePostGIS() {
  const client = await pool.connect();
  try {
    console.log('🔧 Attempting to enable PostGIS...\n');
    
    // Try to create extension
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS enabled!');
    
    // Verify
    const version = await client.query("SELECT PostGIS_Version();");
    console.log(`✅ PostGIS version: ${version.rows[0].postgis_version}`);
    
    // Test it
    const test = await client.query("SELECT ST_AsText(ST_Point(-81.5, 30.2));");
    console.log(`✅ PostGIS working! Test point: ${test.rows[0].st_astext}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nYou need to enable PostGIS in Digital Ocean dashboard:');
    console.log('1. Go to https://cloud.digitalocean.com/databases');
    console.log('2. Click your database');
    console.log('3. Go to Settings tab');
    console.log('4. Look for "Extensions" or "Advanced Settings"');
    console.log('5. Enable PostGIS extension');
  } finally {
    client.release();
    await pool.end();
  }
}

enablePostGIS();