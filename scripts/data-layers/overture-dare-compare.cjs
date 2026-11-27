// Second half of the Dare pilot: uses public.scratch_overture_dare (loaded by overture-dare-pilot.cjs).
// Indexed point-in-parcel match, then compares "has a building" with today's likely_vacant and with the county's own use labels.
// Writes only public.scratch_dare_built (dev scratch). Usage: node overture-dare-compare.cjs
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 900000 });
const show = async (label, sql) => console.log(label, JSON.stringify((await pool.query(sql)).rows));
(async () => {
  await pool.query('ALTER TABLE public.scratch_overture_dare ADD COLUMN IF NOT EXISTS pt geometry(Point,4326)');
  await pool.query('UPDATE public.scratch_overture_dare SET pt = ST_PointOnSurface(geom) WHERE pt IS NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS scratch_overture_dare_pt ON public.scratch_overture_dare USING gist (pt)');
  await pool.query('ANALYZE public.scratch_overture_dare');
  await pool.query('DROP TABLE IF EXISTS public.scratch_dare_built');
  await pool.query(`CREATE TABLE public.scratch_dare_built AS
    SELECT p.gid, p.use_desc, p.likely_vacant, p.improvement_value, p.year_built, p.acreage,
           (SELECT count(*) FROM public.scratch_overture_dare b WHERE ST_Intersects(p.geom, b.pt)) AS n_buildings
      FROM public.parcels_nc p WHERE p.county = 'Dare'`);
  await show('flag x has_building:', `select likely_vacant, (n_buildings>0) has_building, count(*) n from public.scratch_dare_built group by 1,2 order by 1,2`);
  // Ground truth = county's own label says vacant land
  await show('truth(use_desc ~ VACANT) x has_building:', `select (use_desc ilike 'VACANT%') county_says_vacant, (n_buildings>0) has_building, count(*) n from public.scratch_dare_built group by 1,2 order by 1,2`);
  await show('truth x current flag:', `select (use_desc ilike 'VACANT%') county_says_vacant, likely_vacant, count(*) n from public.scratch_dare_built group by 1,2 order by 1,2`);
  await show('flag-vacant but has building, by use_desc:', `select use_desc, count(*) n from public.scratch_dare_built where likely_vacant and n_buildings>0 group by 1 order by 2 desc limit 8`);
  await show('not flagged but no building, by use_desc:', `select use_desc, count(*) n from public.scratch_dare_built where not likely_vacant and n_buildings=0 group by 1 order by 2 desc limit 10`);
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
