const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function repairView() {
  const client = await pool.connect();
  try {
    console.log('🔧 Repairing View (Dropping first)...');
    
    // Drop the view if it exists (CASCADE just in case, though likely no deps yet)
    await client.query('DROP VIEW IF EXISTS public.v_flood_hazard_map CASCADE');
    console.log('Dropped old view.');

    console.log('Re-creating v_flood_hazard_map with source_name...');
    await client.query(`
      CREATE OR REPLACE VIEW public.v_flood_hazard_map AS
      SELECT
        DFIRM_ID,
        source_name,
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
    console.log('✅ View repaired successfully.');

    // Verify index exists (in case previous script crashed before finishing)
    console.log('🔍 Checking source_name index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS flood_hazard_source_idx
      ON public.flood_hazard (source_name);
    `);
    console.log('✅ Index verified.');

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}
repairView();
