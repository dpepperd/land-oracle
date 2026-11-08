const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function migrateSourceColumn() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Adding source_name column...');
    await client.query(`
      ALTER TABLE public.flood_hazard
      ADD COLUMN IF NOT EXISTS source_name VARCHAR(50);
    `);

    console.log('📦 Backfilling existing Duval data...');
    const res = await client.query(`
      UPDATE public.flood_hazard
      SET source_name = 'DUVAL'
      WHERE source_name IS NULL;
    `);
    console.log(`Updated ${res.rowCount} rows.`);

    console.log('🏷️  Indexing source_name...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS flood_hazard_source_idx
      ON public.flood_hazard (source_name);
    `);

    // Update the view to include this new column
    console.log('👁️  Updating v_flood_hazard_map view...');
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

    console.log('✅ Migration Complete: Single-Table Architecture Ready.');

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}
migrateSourceColumn();
