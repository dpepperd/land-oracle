// Generic county test for the building-footprint vacancy rule (generalises the Dare pilot).
// Step 1: node overture-county-test.cjs bbox <County>            -> prints the bounding box
// Step 2: node overture-county-test.cjs run <County> <buildings.csv>
// Writes only public.scratch_ov_<county> and public.scratch_ov_<county>_built (dev scratch). Reads parcels_nc. Never touches app_prod.
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 900000 });
const [mode, county, csv] = process.argv.slice(2);
const slug = county.toLowerCase().replace(/[^a-z]/g, '');
const B = `public.scratch_ov_${slug}`, T = `${B}_built`;
const show = async (label, sql) => console.log(label, JSON.stringify((await pool.query(sql)).rows));

(async () => {
  if (mode === 'bbox') {
    const r = await pool.query(`select min(longitude) xmin, min(latitude) ymin, max(longitude) xmax, max(latitude) ymax, count(*) n from public.parcels_nc where county = $1`, [county]);
    console.log(JSON.stringify(r.rows[0])); return pool.end();
  }
  const rows = fs.readFileSync(csv, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((l) => { const k = l.indexOf(','); return [l.slice(0, k), l.slice(k + 1).replace(/^"|"$/g, '')]; });
  console.log('buildings in file:', rows.length);
  await pool.query(`DROP TABLE IF EXISTS ${B}`);
  await pool.query(`CREATE TABLE ${B} (id text, geom geometry(Geometry,4326), pt geometry(Point,4326))`);
  for (let i = 0; i < rows.length; i += 1000) {
    const vals = [], params = [];
    rows.slice(i, i + 1000).forEach((r, j) => { vals.push(`($${j * 2 + 1}, ST_GeomFromText($${j * 2 + 2}, 4326))`); params.push(r[0], r[1]); });
    await pool.query(`INSERT INTO ${B} (id, geom) VALUES ${vals.join(',')}`, params);
  }
  await pool.query(`UPDATE ${B} SET pt = ST_PointOnSurface(geom)`);
  await pool.query(`CREATE INDEX ON ${B} USING gist (pt)`);
  await pool.query(`ANALYZE ${B}`);
  await pool.query(`DROP TABLE IF EXISTS ${T}`);
  await pool.query(`CREATE TABLE ${T} AS
    SELECT p.gid, p.use_desc, p.likely_vacant, p.improvement_value, p.acreage,
           (SELECT count(*) FROM ${B} b WHERE ST_Intersects(p.geom, b.pt)) AS n_buildings
      FROM public.parcels_nc p WHERE p.county = '${county.replace(/'/g, '')}'`);
  const v = `(use_desc ilike 'VACANT%')`;
  await show('parcels / county-labelled vacant:', `select count(*) n, count(*) filter (where ${v}) vac_label from ${T}`);
  await show('today flag vs label:', `select ${v} label_vacant, likely_vacant, count(*) n from ${T} where use_desc is not null group by 1,2 order by 1,2`);
  await show('no building only vs label:', `select ${v} label_vacant, count(*) n from ${T} where use_desc is not null and n_buildings=0 group by 1 order by 1`);
  await show('no building AND improvement null-or-0 vs label:', `select ${v} label_vacant, count(*) n from ${T} where use_desc is not null and n_buildings=0 and coalesce(improvement_value,0)=0 group by 1 order by 1`);
  await show('no building AND improvement exactly 0 vs label:', `select ${v} label_vacant, count(*) n from ${T} where use_desc is not null and n_buildings=0 and improvement_value=0 group by 1 order by 1`);
  await show('no building AND improvement NULL vs label:', `select ${v} label_vacant, count(*) n from ${T} where use_desc is not null and n_buildings=0 and improvement_value is null group by 1 order by 1`);
  await show('improvement null/0 alone vs label:', `select ${v} label_vacant, count(*) n from ${T} where use_desc is not null and coalesce(improvement_value,0)=0 group by 1 order by 1`);
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
