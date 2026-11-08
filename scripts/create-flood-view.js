const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function createView() {
  const client = await pool.connect();
  try {
    console.log('Creating view v_flood_hazard_map...');
    await client.query(`
      CREATE OR REPLACE VIEW public.v_flood_hazard_map AS
      SELECT
        DFIRM_ID,
        COUNTY,
        FLD_ZONE,
        ZONE_SUBTY,
        SFHA_TF,
        STATIC_BFE,
        DEPTH,
        VELOCITY,
        geom_safe AS geometry
      FROM public.flood_hazard;
    `);
    console.log('✅ View created successfully.');
  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}
createView();
