// Step 2 of the NC footprint rollout: adds vacant_est / vacant_est_basis to public.parcels_nc and fills them for the counties
// processed by nc-footprint-vacant.cjs (NC counties with no land-use codes). Existing likely_vacant values are NOT changed.
//   basis 'footprint+value': county reports improvement values (>= 30% of parcels) -> vacant when no building outline AND improvement value null/0
//   basis 'footprint only' : county reports no usable improvement values            -> vacant when no building outline
// Reversible: UPDATE public.parcels_nc SET vacant_est = NULL, vacant_est_basis = NULL.
// Then it appends the two columns to the END of public.parcels_nc_current (old code ignores them). Dev schema; never app_prod rows.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 3600000 });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  await pool.query('ALTER TABLE public.parcels_nc ADD COLUMN IF NOT EXISTS vacant_est boolean');
  await pool.query('ALTER TABLE public.parcels_nc ADD COLUMN IF NOT EXISTS vacant_est_basis text');
  const done = (await pool.query('SELECT co_no, county FROM public.scratch_nc_vacant_done ORDER BY co_no')).rows;
  log('counties:', done.length);
  for (const d of done) {
    const cov = (await pool.query('SELECT count(improvement_value)::float / count(*) f FROM public.parcels_nc WHERE co_no = $1', [d.co_no])).rows[0].f;
    const withValue = cov >= 0.3;
    const r = await pool.query(`UPDATE public.parcels_nc p
        SET vacant_est = (e.n_buildings = 0 ${withValue ? 'AND coalesce(p.improvement_value, 0) = 0' : ''}),
            vacant_est_basis = $2
       FROM public.scratch_nc_vacant_est e WHERE e.gid = p.gid AND p.co_no = $1`, [d.co_no, withValue ? 'footprint+value' : 'footprint only']);
    log(`${d.county}: ${r.rowCount} updated (${withValue ? 'footprint+value' : 'footprint only'})`);
  }
  // Append the new columns to the view (CREATE OR REPLACE VIEW allows new columns at the end only).
  let def = (await pool.query(`SELECT pg_get_viewdef('public.parcels_nc_current'::regclass) d`)).rows[0].d.trim().replace(/;$/, '');
  if (!/vacant_est/.test(def)) {
    const at = def.search(/\n\s*FROM \(parcels_nc\b/);
    if (at < 0 || !/AS lu_cat\s*$/.test(def.slice(0, at))) throw new Error('unexpected view definition');
    def = def.slice(0, at) + ',\n    parcels_nc.vacant_est,\n    parcels_nc.vacant_est_basis' + def.slice(at);
    await pool.query(`CREATE OR REPLACE VIEW public.parcels_nc_current AS ${def}`);
    const role = (await pool.query(`select 1 from pg_roles where rolname='landoracle_prod'`)).rowCount;
    if (role) await pool.query('GRANT SELECT ON public.parcels_nc_current TO landoracle_prod');
    log('view updated');
  } else log('view already has the columns');
  const t = Date.now(); await pool.query('VACUUM (ANALYZE) public.parcels_nc'); log('vacuum analyze', Math.round((Date.now() - t) / 1000) + 's');
  const s = (await pool.query(`select count(*) filter (where vacant_est is not null) filled, count(*) filter (where vacant_est) vacant, count(*) filter (where vacant_est_basis='footprint only') only_fp from public.parcels_nc`)).rows[0];
  log('FINAL', JSON.stringify(s));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
