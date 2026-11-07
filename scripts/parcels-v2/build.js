// Builds parcels_v2 alongside parcels (v1). Additive only: creates county_codes,
// two normalizer functions and parcels_v2. Never alters, drops or swaps v1.
//
//   node scripts/parcels-v2/build.js [--counties "Union,Leon"] [--max-growth-gb 14] [--skip-indexes]
//
// Resumable: a county that already has rows in parcels_v2 is skipped.
// Each county loads in its own transaction and is verified before COMMIT:
// every v1 gid must appear in exactly one v2 row (sum of v1_gids == v1 count).
const fs = require('fs'), path = require('path');
const shapefile = require('shapefile');
const { Client } = require('pg');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const only = arg('counties', null) ? String(arg('counties')).split(',').map((s) => s.trim()) : null;
const MAX_GROWTH = Number(arg('max-growth-gb', 14)) * 1024 ** 3;
const skipIdx = process.argv.includes('--skip-indexes');

const root = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const sql = (f) => fs.readFileSync(path.join(root, 'db', 'migrations', f), 'utf8');
const gb = (b) => (b / 1024 ** 3).toFixed(2) + ' GB';

async function repairLeon(c) {
  // Leon: parcel_id is truth; parcelno_legacy is repaired from the county shapefile.
  const has = (await c.query('select 1 from parcels_v2 where co_no=47 limit 1')).rowCount;
  if (!has) return null;
  await c.query('CREATE TEMP TABLE IF NOT EXISTS leon_shp (parcel_id text, parcelno text, k text)');
  await c.query('TRUNCATE leon_shp');
  const src = await shapefile.openDbf('D:/LandOracle/Florida/Leon/gis/leon_2025par.dbf');
  let a = [], b = [], n = 0;
  const flush = async () => {
    if (!a.length) return;
    await c.query("INSERT INTO leon_shp SELECT p, q, normalize_parcel_id(coalesce(nullif(btrim(p),''), q), 'Leon') FROM unnest($1::text[], $2::text[]) t(p, q)", [a, b]);
    a = []; b = [];
  };
  while (true) {
    const r = await src.read(); if (r.done) break;
    a.push(String(r.value.PARCEL_ID ?? '').trim()); b.push(String(r.value.PARCELNO ?? '').trim()); n++;
    if (a.length >= 5000) await flush();
  }
  await flush();
  await c.query('BEGIN');
  const repaired = await c.query(`
    UPDATE parcels_v2 v SET parcelno_legacy = s.parcelno,
           note = CASE WHEN v.parcelno_legacy IS DISTINCT FROM s.parcelno AND coalesce(v.note,'') NOT LIKE '%leon_parcelno_repaired%'
                       THEN concat_ws(';', v.note, 'leon_parcelno_repaired') ELSE v.note END
    FROM (SELECT k, min(parcelno) AS parcelno FROM leon_shp WHERE k IS NOT NULL GROUP BY k) s
    WHERE v.co_no = 47 AND v.match_key = s.k AND v.parcelno_legacy IS DISTINCT FROM s.parcelno`);
  const unverified = await c.query(`
    UPDATE parcels_v2 v SET parcelno_legacy = NULL, needs_review = true,
           note = concat_ws(';', v.note, 'leon_parcelno_unverified')
    WHERE v.co_no = 47 AND coalesce(v.note,'') NOT LIKE '%leon_parcelno_unverified%'
      AND (v.match_key IS NULL OR v.match_key NOT IN (SELECT k FROM leon_shp WHERE k IS NOT NULL))`);
  await c.query('COMMIT');
  return { shapefile_rows: n, repaired: repaired.rowCount, unverified: unverified.rowCount };
}

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, keepAlive: true });
  await c.connect();
  await c.query('SET statement_timeout = 0');
  await c.query("SET work_mem = '256MB'");
  const baseline = Number((await c.query('select pg_database_size(current_database()) s')).rows[0].s);
  console.log('baseline db size', gb(baseline), '| abort if growth >', gb(MAX_GROWTH));

  for (const f of ['001_county_codes.sql', '002_normalize_parcel_id.sql', '003_parcels_v2.sql']) await c.query(sql(f));

  const v1 = (await c.query('select county, count(*)::int n from parcels group by 1')).rows;
  const codes = (await c.query('select co_no, name from county_codes')).rows;
  const byName = new Map(codes.map((r) => [r.name, r.co_no]));
  const missing = v1.filter((r) => !byName.has(r.county));
  if (missing.length) throw new Error('counties without a county_codes row: ' + missing.map((r) => r.county).join(', '));

  const work = v1.filter((r) => !only || only.includes(r.county)).sort((x, y) => x.n - y.n);
  const build = sql('004_parcels_v2_build_county.sql');
  for (const { county, n } of work) {
    const co = byName.get(county);
    if ((await c.query('select 1 from parcels_v2 where co_no=$1 limit 1', [co])).rowCount) { console.log('skip (already built)', county); continue; }
    const t0 = Date.now();
    await c.query('BEGIN');
    try {
      await c.query(build, [county, co]);
      const chk = (await c.query('select count(*)::int rows, coalesce(sum(cardinality(v1_gids)),0)::int covered, count(distinct v1_gids[1])::int firsts from parcels_v2 where co_no=$1', [co])).rows[0];
      if (chk.covered !== n) throw new Error(`coverage mismatch ${county}: v1=${n} covered=${chk.covered}`);
      await c.query('COMMIT');
      const size = Number((await c.query('select pg_database_size(current_database()) s')).rows[0].s);
      console.log(`ok ${county.padEnd(13)} v1=${n} v2=${chk.rows} merged_away=${n - chk.rows} ${((Date.now() - t0) / 1000).toFixed(1)}s db=${gb(size)}`);
      if (size - baseline > MAX_GROWTH) throw new Error('size guard tripped: db grew ' + gb(size - baseline));
    } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; }
  }

  const leon = await repairLeon(c);
  if (leon) console.log('leon repair', JSON.stringify(leon));

  if (!skipIdx && !only) {
    await c.query("SET maintenance_work_mem = '1GB'");
    const left = (await c.query('select count(*)::int n from parcels_v2 p right join county_codes cc using (co_no) where p.id is null')).rows[0].n;
    if (left) console.log('NOTE: some counties have no v2 rows; building indexes anyway');
    console.log('building indexes...'); const t0 = Date.now();
    await c.query(sql('005_parcels_v2_indexes.sql'));
    await c.query('ANALYZE parcels_v2');
    console.log(`indexes+analyze done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await c.end(); console.log('ALLDONE');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
