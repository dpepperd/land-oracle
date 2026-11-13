// Adds land-use categories to the North Carolina search view: a small lookup table (county wording -> category, built with
// nc-use-classify.cjs) joined into public.parcels_nc_current as the new last column lu_cat. No rows of parcels_nc are rewritten.
// Re-run it after changing the rules. Usage: node scripts/data-layers/nc-use-categories.cjs
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const { classify } = require('./nc-use-classify.cjs');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 900000 });
(async () => {
  const rows = (await pool.query(`select distinct upper(btrim(use_desc)) d from public.parcels_nc where use_desc is not null`)).rows.map((r) => r.d).filter(Boolean);
  await pool.query('CREATE TABLE IF NOT EXISTS public.nc_use_map (u_desc text PRIMARY KEY, cat text)');
  await pool.query('TRUNCATE public.nc_use_map');
  const vals = rows.map((d) => [d, classify(d)]).filter((x) => x[1]);
  for (let i = 0; i < vals.length; i += 500) {
    const chunk = vals.slice(i, i + 500);
    await pool.query('INSERT INTO public.nc_use_map (u_desc, cat) SELECT * FROM unnest($1::text[], $2::text[])', [chunk.map((x) => x[0]), chunk.map((x) => x[1])]);
  }
  console.log('mapped wordings:', vals.length, 'of', rows.length);
  let def = (await pool.query(`select pg_get_viewdef('public.parcels_nc_current'::regclass, true) d`)).rows[0].d.trim().replace(/;$/, '');
  if (/lu_cat/.test(def)) def = def.replace(/,\s*COALESCE\(m\.cat[\s\S]*?AS lu_cat/, '').replace(/\s+LEFT JOIN public\.nc_use_map[^\n]*/, '');
  if (!/FROM parcels_nc$/.test(def)) throw new Error('unexpected view definition tail: ' + def.slice(-80));
  const next = def.replace(/FROM parcels_nc$/, `FROM parcels_nc LEFT JOIN public.nc_use_map m ON m.u_desc = upper(btrim(parcels_nc.use_desc))`)
    .replace(/\n\s+source_revised,/, '\n    source_revised,').replace(/(acreage_source)\s+FROM/, `$1,\n    COALESCE(m.cat, CASE WHEN parcels_nc.likely_vacant THEN 'vacant' END) AS lu_cat\n   FROM`);
  await pool.query(`CREATE OR REPLACE VIEW public.parcels_nc_current AS ${next}`);
  const role = (await pool.query(`select 1 from pg_roles where rolname='landoracle_prod'`)).rowCount;
  if (role) await pool.query('GRANT SELECT ON public.parcels_nc_current, public.nc_use_map TO landoracle_prod');
  const s = (await pool.query(`select lu_cat, count(*) n from public.parcels_nc_current group by 1 order by 2 desc`)).rows;
  s.forEach((r) => console.log(r.lu_cat, r.n));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
