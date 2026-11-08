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
    console.log('Creating highways table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS highways (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50),
        geom GEOMETRY(LineString, 4326)
      );
    `);

    // Insert Interstate 10 (Approximation through Baker County)
    // I-10 runs West-East roughly at Latitude 30.28
    console.log('Inserting Demo Highway (I-10)...');
    await client.query(`
      INSERT INTO highways (name, type, geom)
      VALUES (
        'I-10', 
        'Interstate',
        ST_GeomFromText('LINESTRING(-82.4 30.28, -82.1 30.28)', 4326)
      );
    `);
    
    console.log('Adding distance_to_highway column to parcels...');
    await client.query("ALTER TABLE parcels ADD COLUMN IF NOT EXISTS distance_to_highway NUMERIC;");
    
    console.log('Calculating distances (this may take a moment)...');
    // For every parcel, find distance to nearest highway (in miles)
    // 1609.34 meters = 1 mile
    await client.query(`
      UPDATE parcels p
      SET distance_to_highway = (
        SELECT MIN(ST_Distance(p.geom::geography, h.geom::geography) / 1609.34)
        FROM highways h
      )
      WHERE distance_to_highway IS NULL;
    `);
    
    console.log('✅ Highways setup complete.');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
