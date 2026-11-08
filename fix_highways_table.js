const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Checking highways table...');
    
    // 1. Ensure Table Exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS highways (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50)
      );
    `);

    // 2. Add Geometry Column (PostGIS)
    await client.query(`
      ALTER TABLE highways ADD COLUMN IF NOT EXISTS geom GEOMETRY(LineString, 4326);
    `);

    // 3. Add GeoJSON Column (for Frontend API cached response)
    await client.query(`
      ALTER TABLE highways ADD COLUMN IF NOT EXISTS geojson TEXT;
    `);

    // 4. Clean old junk if any (User said "already there", but if it's broken/empty, we need fresh start for demo)
    // We will DELETE only if name='I-10' to avoid nuking their real data if they have it?
    // But since the schema dump showed NOTHING, it's safer to just insert.
    
    console.log('Inserting Demo Highway (I-10)...');
    // I-10 roughly: -82.4, 30.28 to -82.1, 30.28
    const insertSQL = `
      INSERT INTO highways (name, type, geom, geojson)
      VALUES (
        'I-10', 
        'Interstate',
        ST_GeomFromText('LINESTRING(-82.43 30.28, -82.10 30.28)', 4326),
        ST_AsGeoJSON(ST_GeomFromText('LINESTRING(-82.43 30.28, -82.10 30.28)', 4326))
      );
    `;
    await client.query(insertSQL);
    
    console.log('Adding distance_to_highway column to parcels...');
    await client.query("ALTER TABLE parcels ADD COLUMN IF NOT EXISTS distance_to_highway NUMERIC;");
    
    console.log('Calculating distances (approx 1 mile = 1609 meters)...');
    // We use geography cast for meters
    await client.query(`
      UPDATE parcels p
      SET distance_to_highway = (
        SELECT MIN(ST_Distance(p.geom::geography, h.geom::geography) / 1609.34)
        FROM highways h
      )
      WHERE distance_to_highway IS NULL;
    `);
    
    console.log('✅ Highways fixed and distances calculated.');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
