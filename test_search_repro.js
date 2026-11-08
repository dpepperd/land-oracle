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
    console.log("Testing Spatial Query...");
    
    // Simulate the query exactly as route.ts does
    const userId = 'user_2s...'; // Mock user
    const limit = 10;
    
    const polygon = {
      "type": "Polygon",
      "coordinates": [[
        [-82.3, 30.2], [-82.2, 30.2], [-82.2, 30.3], [-82.3, 30.3], [-82.3, 30.2]
      ]]
    };
    
    // Construct the exact SQL from route.ts
    const sql = `
      WITH user_context AS (
        SELECT id, role FROM users WHERE clerk_id = $1
      )
      SELECT 
        p.gid as id,
        p.parcelno as parcel_id,
        ST_Y(ST_Centroid(p.geom)) as latitude,
        ST_X(ST_Centroid(p.geom)) as longitude,
        ST_AsGeoJSON(ST_Simplify(p.geom, 0.0001)) as geojson
      FROM parcels p
      WHERE 
        ST_Within(
          ST_PointOnSurface(p.geom),
          ST_MakeValid(
            ST_ForcePolygonCCW(
              ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
            )
          )
        )
      LIMIT $3
    `;
    
    const values = [userId, JSON.stringify(polygon), limit];
    
    const start = Date.now();
    const res = await client.query(sql, values);
    console.log(`Success! Returned ${res.rows.length} rows in ${Date.now() - start}ms`);
    
  } catch (err) {
    console.error("\n=== QUERY METASTASIZED ERROR ===");
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
