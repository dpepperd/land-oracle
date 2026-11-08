const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateHighways() {
  const client = await pool.connect();
  try {
    console.log('🛣️  Preparing Highway Schema...');

    await client.query('BEGIN');

    // 1. Create highways table
    // Storing geometry as basic GeoJSON string for client-side processing since no PostGIS
    console.log('   - Creating table: highways');
    await client.query(`
      CREATE TABLE IF NOT EXISTS highways (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(100), -- 'Interstate', 'US Highway'
        geojson TEXT NOT NULL -- LineString geometry
      );
    `);

    // 2. Add distance column to parcels
    console.log('   - Adding distance_to_highway column to parcels...');
    await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS distance_to_highway DOUBLE PRECISION;
    `);

    // Index on distance for faster filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parcels_distance_to_highway ON parcels(distance_to_highway);
    `);

    await client.query('COMMIT');
    console.log('✅ Highway schema applied!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying schema:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrateHighways();
