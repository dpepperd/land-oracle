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
    console.log('Adding acreage column...');
    await client.query("ALTER TABLE parcels ADD COLUMN IF NOT EXISTS acreage NUMERIC");
    
    console.log('Calculating acreage from geometry (ST_Area)...');
    // sq meters to acres: * 0.000247105
    // BUT Wait. SRID 4326 is degrees. ST_Area gives sq degrees.
    // We must cast to geography for sq meters.
    await client.query(`
      UPDATE parcels 
      SET acreage = ST_Area(geom::geography) * 0.000247105 
      WHERE acreage IS NULL
    `);
    
    console.log('✅ Acreage Added and Backfilled.');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
