// Dare County pilot: does "no building on the parcel" (Overture outlines) predict vacant land better than today's likely_vacant flag?
// Writes ONLY to a scratch table public.scratch_overture_dare (dev schema). Reads parcels_nc. Never touches app_prod or parcels_nc rows.
// Usage: node overture-dare-pilot.cjs <buildings.csv>
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 600000 });

function parseCsv(text) {
  // rows are: id,"WKT" ; WKT has commas so it is quoted
  const out = []; const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]; if (!l) continue;
    const k = l.indexOf(','); out.push([l.slice(0, k), l.slice(k + 1).replace(/^"|"$/g, '')]);
  }
  return out;
}

(async () => {
  const rows = parseCsv(fs.readFileSync(process.argv[2], 'utf8'));
  console.log('buildings in file:', rows.length);
  await pool.query('DROP TABLE IF EXISTS public.scratch_overture_dare');
  await pool.query('CREATE TABLE public.scratch_overture_dare (id text, geom geometry(Geometry,4326))');
  for (let i = 0; i < rows.length; i += 1000) {
    const b = rows.slice(i, i + 1000);
    const vals = []; const params = [];
    b.forEach((r, j) => { vals.push(`($${j * 2 + 1}, ST_GeomFromText($${j * 2 + 2}, 4326))`); params.push(r[0], r[1]); });
    await pool.query(`INSERT INTO public.scratch_overture_dare (id, geom) VALUES ${vals.join(',')}`, params);
  }
  await pool.query('CREATE INDEX ON public.scratch_overture_dare USING gist (geom)');
  await pool.query('ANALYZE public.scratch_overture_dare');
  const srid = (await pool.query(`select ST_SRID(geom) s from public.parcels_nc where county='Dare' limit 1`)).rows[0].s;
  console.log('parcel SRID:', srid);

  const uses = await pool.query(`select use_desc, count(*) n, count(*) filter (where likely_vacant) vac from public.parcels_nc where county='Dare' group by 1 order by 2 desc limit 15`);
  console.log('Dare use_desc top:', JSON.stringify(uses.rows));

  // built = some building's representative point lies inside the parcel
  await pool.query('DROP TABLE IF EXISTS public.scratch_dare_built');
  await pool.query(`CREATE TABLE public.scratch_dare_built AS
    SELECT p.gid, p.use_desc, p.likely_vacant, p.improvement_value, p.year_built, p.acreage,
           EXISTS (SELECT 1 FROM public.scratch_overture_dare b WHERE ST_Intersects(p.geom, ST_PointOnSurface(b.geom))) AS has_building
      FROM public.parcels_nc p WHERE p.county = 'Dare'`);
  const m = await pool.query(`select likely_vacant, has_building, count(*) n from public.scratch_dare_built group by 1,2 order by 1,2`);
  console.log('likely_vacant x has_building:', JSON.stringify(m.rows));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
