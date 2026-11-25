// Builds public.county_parcel_counts (one row per county) so /api/parcels/stats does not have to GROUP BY ~11M rows on a cold cache.
// Re-run after a Florida data load. Safe to run any time: it replaces the table in one transaction. Usage: node scripts/data-layers/county-counts.cjs
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
(async () => {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 300000 });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('CREATE TABLE IF NOT EXISTS public.county_parcel_counts (county text PRIMARY KEY, n integer NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now())');
    await c.query('DELETE FROM public.county_parcel_counts');
    const r = await c.query("INSERT INTO public.county_parcel_counts (county, n) SELECT county, COUNT(*)::int FROM parcels_v2 WHERE county IS NOT NULL AND NOT quarantine GROUP BY county");
    await c.query('GRANT SELECT ON public.county_parcel_counts TO landoracle_prod');
    await c.query('COMMIT');
    const t = await pool.query('SELECT COUNT(*) c, SUM(n) s FROM public.county_parcel_counts');
    console.log('counties', r.rowCount, t.rows[0]);
  } catch (e) { await c.query('ROLLBACK'); console.error(e.message); process.exitCode = 1; } finally { c.release(); await pool.end(); }
})();
