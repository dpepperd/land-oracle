const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function checkPlan() {
  const client = await pool.connect();
  try {
    const query = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT FLD_ZONE, SFHA_TF, STATIC_BFE
      FROM public.flood_hazard
      WHERE ST_Intersects(
        geom_safe,
        ST_SetSRID(ST_Point(-81.6557, 30.3322), 4326)
      )
      LIMIT 20;
    `;
    console.log('Running EXPLAIN ANALYZE...');
    const res = await client.query(query);
    res.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
checkPlan();
