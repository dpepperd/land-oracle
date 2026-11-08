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
    console.log('Stopping any stuck queries...');
    // Optional: Terminate stuck backend PIDs? (Dangerous if shared). Skip for now.
    
    console.log('Creating Spatial Indices (The Speed Boost) 🚀...');
    
    // 1. Index on Parcels GIST
    await client.query("CREATE INDEX IF NOT EXISTS parcels_geom_idx ON parcels USING GIST (geom)");
    
    // 2. Index on Highways GIST
    await client.query("CREATE INDEX IF NOT EXISTS highways_geom_idx ON highways USING GIST (geom)");
    
    console.log('Calculating distances (Indexed)...');
    
    // Optimization: CROSS JOIN LATERAL with <-> operator (Nearest Neighbor)
    // <-> is index-accelerated for "nearest". 
    // ST_Distance is just a function.
    // BUT finding MIN(ST_Distance) for every parcel against ALL highways might be slow.
    // Better: 
    // UPDATE parcels p SET distance_to_highway = (
    //   SELECT ST_Distance(p.geom::geography, h.geom::geography) / 1609.34
    //   FROM highways h
    //   ORDER BY p.geom <-> h.geom LIMIT 1
    // );
    // The <-> operator uses the index to find the nearest object instantly.
    
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
    
    console.log('✅ Distances calculated!');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
