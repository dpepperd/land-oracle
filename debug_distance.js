const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  const client = await pool.connect();
  try {
    console.log('Debugging Distance calculation...');
    
    // 1. Check one parcel
    const pRes = await client.query('SELECT gid, st_astext(geom) as geom FROM parcels LIMIT 1');
    const parcel = pRes.rows[0];
    console.log('Parcel:', parcel.gid, parcel.geom);
    
    // 2. Check one highway
    const hRes = await client.query('SELECT id, st_astext(geom) as geom FROM highways LIMIT 1');
    const highway = hRes.rows[0];
    console.log('Highway:', highway.id, highway.geom);
    
    // 3. Test Distance
    const distRes = await client.query(`
      SELECT ST_Distance(
        ST_GeomFromText($1, 4326)::geography, 
        ST_GeomFromText($2, 4326)::geography
      ) / 1609.34 as dist_miles
    `, [parcel.geom, highway.geom]);
    
    console.log('Test Distance (Miles):', distRes.rows[0].dist_miles);
    
    // 4. Force Update One
    await client.query(`
      UPDATE parcels 
      SET distance_to_highway = 999 
      WHERE gid = $1
    `, [parcel.gid]);
    console.log('Forced update of one parcel to 999.');
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

debug();
