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
    console.log('Running migration...');
    
    // Check existing extensions
    console.log('Checking installed extensions...');
    const extRes = await client.query('SELECT extname, extversion FROM pg_extension');
    console.log('Installed extensions:', extRes.rows);

    // List Databases
    console.log('Listing databases...');
    const dbRes = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    console.log('Databases on server:', dbRes.rows.map(r => r.datname));

    // 1. Enable PostGIS
    console.log('Attempting to enable PostGIS extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ CREATE EXTENSION command executed successfully.');
    } catch (e) {
      console.log('⚠️ CREATE EXTENSION failed:', e.message);
    }
    
    // Check version
    try {
      const res = await client.query('SELECT PostGIS_Version();');
      console.log('✅ PostGIS Version:', res.rows[0].postgis_version);
    } catch (e) {
      console.log('❌ PostGIS version check failed (Extension likely not installed).');
      return; // Stop if PostGIS is missing
    }

    // 2. Update parcels table schema
    console.log('Updating parcels table schema...');
    
    await client.query(`
      ALTER TABLE parcels 
      ALTER COLUMN geom TYPE GEOGRAPHY(Point, 4326) 
      USING geom::geography;
    `);
    
    console.log('✅ Column geom updated to GEOGRAPHY(Point, 4326)');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.detail) console.error('Details:', err.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();