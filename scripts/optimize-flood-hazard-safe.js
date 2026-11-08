const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function optimizeSafeGeom() {
  const client = await pool.connect();
  try {
    console.log('🛡️ Adding geom_safe column...');
    await client.query(`
      ALTER TABLE public.flood_hazard
      ADD COLUMN IF NOT EXISTS geom_safe geometry(MULTIPOLYGON, 4326);
    `);

    console.log('✨ Populating geom_safe (Healing invalid geometries)...');
    // Note: Using 'geom' as the source column name
    await client.query(`
      UPDATE public.flood_hazard
      SET geom_safe =
        CASE
          WHEN ST_IsValid(geom) THEN geom
          ELSE ST_MakeValid(geom)::geometry(MULTIPOLYGON, 4326)
        END
      WHERE geom_safe IS NULL;
    `);

    console.log('INDEX Creating Spatial Index on geom_safe...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS flood_hazard_geom_safe_gix
      ON public.flood_hazard
      USING GIST (geom_safe);
    `);

    console.log('✅ geom_safe optimization complete.');

    // Optional: Analyze to update stats for the new column
    console.log('📊 Analyzing table...');
    await client.query('ANALYZE public.flood_hazard');

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}

optimizeSafeGeom();
