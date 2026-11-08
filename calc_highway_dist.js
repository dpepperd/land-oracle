const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adding distance_to_highway column...');
    await client.query("ALTER TABLE parcels ADD COLUMN IF NOT EXISTS distance_to_highway NUMERIC");
    
    console.log('Calculating distances (this may take a minute for 745 highways x 30k parcels)...');
    // Using LATERAL JOIN or just simple subquery might be slow but it's a one-time migration.
    // 1609.34 meters = 1 mile
    // Note: ST_Distance((geography), (geography)) returns meters.
    // We cast to geography for accurate distance calc.
    
    await client.query(`
      UPDATE parcels p
      SET distance_to_highway = (
        SELECT MIN(ST_Distance(p.geom::geography, h.geom::geography)) / 1609.34
        FROM highways h
      )
      WHERE distance_to_highway IS NULL;
    `);
    
    console.log('✅ Distances calculated!');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
