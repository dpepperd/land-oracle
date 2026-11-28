// Step 1 of the NC footprint rollout: for every NC county with NO land-use codes, count the Overture building outlines on each parcel.
// Resumable (skips counties already in public.scratch_nc_vacant_done). Writes ONLY scratch tables in the dev schema:
//   public.scratch_nc_bldg_pts (co_no, pt), public.scratch_nc_vacant_est (co_no, gid, n_buildings), public.scratch_nc_vacant_done (co_no, ...)
// parcels_nc itself is NOT modified. Never touches app_prod.
// Usage: PY=<python with duckdb> node nc-footprint-vacant.cjs <overture-release> <workdir>
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');
const { pipeline } = require('stream/promises');

const [release, workdir] = process.argv.slice(2);
const PY = process.env.PY || 'python';
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 3600000 });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  fs.mkdirSync(workdir, { recursive: true });
  const c = await pool.connect();
  await c.query('CREATE TABLE IF NOT EXISTS public.scratch_nc_bldg_pts (co_no int, pt geometry(Point,4326))');
  await c.query('CREATE INDEX IF NOT EXISTS scratch_nc_bldg_pts_gix ON public.scratch_nc_bldg_pts USING gist (pt)');
  await c.query('CREATE TABLE IF NOT EXISTS public.scratch_nc_vacant_est (co_no int, gid bigint, n_buildings int)');
  await c.query('CREATE INDEX IF NOT EXISTS scratch_nc_vacant_est_gid ON public.scratch_nc_vacant_est (gid)');
  await c.query('CREATE TABLE IF NOT EXISTS public.scratch_nc_vacant_done (co_no int primary key, county text, parcels int, buildings int, done_at timestamptz default now())');

  const todo = (await c.query(`
    SELECT co_no, county, count(*)::int n, min(longitude) xmin, min(latitude) ymin, max(longitude) xmax, max(latitude) ymax
      FROM public.parcels_nc GROUP BY 1,2
     HAVING 100.0 * count(coalesce(use_desc, use_code)) / count(*) < 5
        AND co_no NOT IN (SELECT co_no FROM public.scratch_nc_vacant_done)
     ORDER BY n`)).rows;
  log('counties to do:', todo.length);

  for (const t of todo) {
    const csv = path.join(workdir, `bldg-${t.co_no}.csv`);
    log(`${t.county} (${t.co_no}): ${t.n} parcels, pulling buildings`);
    const r = spawnSync(PY, [path.join(__dirname, 'overture-buildings-pull.py'), release, t.xmin, t.ymin, t.xmax, t.ymax, csv], { env: { ...process.env, POINTS: '1' }, encoding: 'utf8' });
    if (r.status !== 0) { log('pull FAILED', (r.stderr || '').slice(-300)); continue; }
    await c.query('DELETE FROM public.scratch_nc_bldg_pts WHERE co_no = $1', [t.co_no]);
    await c.query('DROP TABLE IF EXISTS pg_temp.stage_b');
    await c.query('CREATE TEMP TABLE stage_b (id text, wkt text)');
    await pipeline(fs.createReadStream(csv), c.query(copyFrom('COPY stage_b FROM STDIN WITH (FORMAT csv, HEADER true)')));
    const ins = await c.query(`INSERT INTO public.scratch_nc_bldg_pts SELECT $1, ST_GeomFromText(wkt, 4326) FROM stage_b`, [t.co_no]);
    await c.query('ANALYZE public.scratch_nc_bldg_pts');
    log(`  loaded ${ins.rowCount} building points, matching parcels`);
    await c.query('DELETE FROM public.scratch_nc_vacant_est WHERE co_no = $1', [t.co_no]);
    await c.query(`INSERT INTO public.scratch_nc_vacant_est
      SELECT p.co_no, p.gid, (SELECT count(*) FROM public.scratch_nc_bldg_pts b WHERE ST_Intersects(p.geom, b.pt))::int
        FROM public.parcels_nc p WHERE p.co_no = $1`, [t.co_no]);
    await c.query('INSERT INTO public.scratch_nc_vacant_done (co_no, county, parcels, buildings) VALUES ($1,$2,$3,$4)', [t.co_no, t.county, t.n, ins.rowCount]);
    fs.unlinkSync(csv);
    log(`  ${t.county} done`);
  }
  log('ALL DONE');
  c.release(); await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
