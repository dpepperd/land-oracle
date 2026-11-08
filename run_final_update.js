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
    console.log('Running Final Distance Update...');
    // We update in batches to avoid locking the universe if it's slow
    // But since indices are there, it should be fast.
    
    const countRes = await client.query('SELECT count(*) FROM parcels WHERE distance_to_highway IS NULL');
    console.log(`Parcels to update: ${countRes.rows[0].count}`);
    
    // Run update
    await client.query(`
      UPDATE parcels p
      SET distance_to_highway = (
        SELECT ST_Distance(p.geom::geography, h.geom::geography) / 1609.34
        FROM highways h
        ORDER BY p.geom <-> h.geom ASC
        LIMIT 1
      )
      WHERE distance_to_highway IS NULL;
    `);
    
    const verifyRes = await client.query('SELECT count(*) FROM parcels WHERE distance_to_highway IS NOT NULL');
    console.log(`✅ Update Complete. Parcels with distance: ${verifyRes.rows[0].count}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
