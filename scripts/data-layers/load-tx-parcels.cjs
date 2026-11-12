// Load TxGIO StratMap land parcels (CC0, from county appraisal districts) into a staging table shaped like NC's parcels table.
// Source files: https://tnris-data-warehouse.s3.amazonaws.com/LCD/collection/stratmap-2025-land-parcels/items/shp/stratmap-2025-land-parcels-<county>_<fips5>_shp.zip
// Usage: node scripts/data-layers/load-tx-parcels.cjs <table> <county3> <path-to-.shp>[,<second .shp>]   e.g. tx_parcels_stage 453 D:/tx/travis.shp
//   (a county can come as several files, e.g. Harris east + west: pass them comma-separated so duplicate IDs are numbered across both)
// Safe to re-run: the county is deleted and reloaded. Writes only to the named table. Reads local files only.
// Rules:
//   - rows with Prop_ID empty or 0 are skipped: in Travis these are business personal property accounts that reuse a parcel's shape (not land)
//   - a Prop_ID that appears again gets a -D2, -D3 suffix on the key (same convention as NC)
//   - land use: Texas state property class (A1, C1, D1 ...) from STAT_LAND_ when the county supplies it; otherwise unknown (NULL), never guessed
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const shapefile = require('shapefile');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const table = process.argv[2], county = process.argv[3], files = (process.argv[4] || '').split(',').filter(Boolean);
if (!/^[a-z_]+$/.test(table || '') || !/^\d{3}$/.test(county || '') || !files.length) { console.error('usage: <table> <county3> <shp[,shp]>'); process.exit(1); }
const LIMIT = Number(process.env.TX_LIMIT || 0); // test mode: stop after N parcels
const BATCH = 400;

const THROTTLE_MS = Number(process.env.THROTTLE_MS || 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const probeSql = "SELECT count(*) FROM parcels_current_all p WHERE p.county = 'Duval' AND p.jv >= 2000000";
async function probe() { const t = Date.now(); await pool.query(probeSql); return Date.now() - t; }
let baseline = null, batches = 0;
async function gentle() { // the live site shares this database: slow down whenever a normal search gets slow
  await sleep(THROTTLE_MS);
  if (++batches % 25 !== 0) return;
  if (baseline === null) { const a = []; for (let i = 0; i < 3; i++) a.push(await probe()); a.sort((x, y) => x - y); baseline = Math.max(a[1], 50); console.log('  baseline search probe ms:', baseline); return; }
  let t = await probe(), waited = 0;
  while (t > Math.max(baseline * 3, 1500) && waited < 900000) { console.log('  site probe slow (' + t + 'ms vs ' + baseline + '), pausing 30s'); await sleep(30000); waited += 30000; t = await probe(); }
}

const clean = (v) => { if (v === null || v === undefined) return null; const s = String(v).replace(/\s+/g, ' ').trim(); return s === '' || s === '0' ? null : s; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const toDate = (s) => { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s || '')); return m && +m[1] >= 2000 ? `${m[1]}-${m[2]}-${m[3]}` : null; };
// Texas Comptroller property classes (first letter of the state code)
const CLASS = { A: 'Single-family residential', B: 'Multifamily residential', C: 'Vacant lot / land tract', D: 'Rural land (farm / ranch)', E: 'Rural improvements', F: 'Commercial / industrial', G: 'Oil, gas and minerals', H: 'Tangible personal property', J: 'Utilities', L: 'Commercial personal property', M: 'Mobile home', N: 'Intangible personal property', O: 'Residential inventory', S: 'Special inventory', X: 'Exempt' };
function landUse(raw) {
  const toks = [...new Set(String(raw || '').toUpperCase().split(/[,;/ ]+/).map((t) => t.trim()).filter((t) => /^[A-Z][0-9A-Z]?$/.test(t)))];
  if (!toks.length) return { code: null, desc: null, vacant: null };
  const first = toks[0];
  const desc = `${CLASS[first[0]] || 'Other'} (${toks.join(', ')})`;
  // C1/C2/C3 = vacant lots and tracts. Mixed accounts (a vacant lot plus an improved class) are not vacant.
  const vacant = toks.every((t) => t[0] === 'C');
  return { code: toks.join(','), desc, vacant };
}
function acres(p) {
  const g = Number(p.GIS_AREA), u = String(p.GIS_AREA_U || '').toLowerCase();
  if (g > 0) { if (u.startsWith('acre')) return g; if (u.startsWith('sq') && /f/.test(u)) return g / 43560; if (u.startsWith('sq') && /m/.test(u)) return g / 4046.8564; }
  const m = /^([\d.]+)\s*(AC|ACRES?)?$/i.exec(String(p.LEGAL_AREA || '').trim());
  return m && Number(m[1]) > 0 && (!m[2] || /^ac/i.test(m[2])) ? Number(m[1]) : null;
}
function streetLine(p) {
  const num = clean(p.SITUS_NUM), st = [clean(p.SITUS_ST_1), clean(p.SITUS_ST_2)].filter(Boolean).join(' ');
  if (!st) return null;
  return [num, st].filter(Boolean).join(' ');
}
// "126 GOOSEN WAY, CIBOLO, TX 78108" -> "126 GOOSEN WAY" (some counties give only the combined line)
function mailStreet(a) { const s = clean(a); if (!s) return null; const t = s.replace(/,\s*[^,]+,\s*[A-Z]{2}\s+[\d-]+\s*$/, "").trim(); return t || null; }
function round7(c) { return typeof c[0] === 'number' ? [Math.round(c[0] * 1e7) / 1e7, Math.round(c[1] * 1e7) / 1e7] : c.map(round7); }

const COLS = ['parcel_key', 'parcel_key_local', 'county', 'co_no', 'parcel_id', 'alt_key', 'own_name', 'own_addr1', 'own_addr2', 'own_city', 'own_state', 'own_zipcd',
  'phy_addr1', 'phy_city', 'phy_zipcd', 'acreage', 'use_code', 'use_desc', 'jv', 'land_value', 'improvement_value', 'year_built', 'likely_vacant', 'source_revised'];

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.${table} (
    gid bigserial PRIMARY KEY, state char(2) NOT NULL DEFAULT 'TX', parcel_key text NOT NULL, parcel_key_local text, county text, co_no smallint,
    parcel_id text, alt_key text, own_name text, own_addr1 text, own_addr2 text, own_city text, own_state text, own_zipcd text,
    phy_addr1 text, phy_addr2 text, phy_city text, phy_zipcd text, acreage numeric, use_code text, use_desc text, owner_type text,
    jv bigint, land_value bigint, improvement_value bigint, year_built smallint, sale1_date date, likely_vacant boolean, source_revised date,
    latitude double precision, longitude double precision, geom geometry(MultiPolygon, 4326), loaded_at timestamptz DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_geom_gix ON public.${table} USING gist (geom)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_cty ON public.${table} (co_no)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_key ON public.${table} (parcel_key)`);
  await pool.query(`DELETE FROM public.${table} WHERE co_no = $1`, [Number(county)]);

  const t0 = Date.now(), seen = new Map(), stat = { read: 0, noId: 0, noGeom: 0, loaded: 0, dupSuffixed: 0, use: 0, acres: 0, own: 0, jv: 0 };
  let buf = [];
  const flush = async () => {
    if (!buf.length) return;
    const vals = [], ph = [];
    buf.forEach((r, i) => {
      const b = i * (COLS.length + 1);
      ph.push(`(${COLS.map((_, k) => `$${b + k + 1}`).join(',')},ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${b + COLS.length + 1}),4326)),3)))`);
      COLS.forEach((c) => vals.push(r[c] === undefined ? null : r[c])); vals.push(r.geometry);
    });
    await pool.query(`INSERT INTO public.${table} (${COLS.join(',')},geom) VALUES ${ph.join(',')}`, vals);
    stat.loaded += buf.length; buf = []; await gentle();
  };

  for (const shp of files) {
    const src = await shapefile.open(shp, shp.replace(/\.shp$/i, '.dbf'), { encoding: 'utf-8' });
    for (;;) {
      const r = await src.read(); if (r.done) break;
      const p = r.value.properties; stat.read++;
      // TX_ID_FALLBACK=geo: a county whose file has no Prop_ID at all (Robertson) uses its GEO_ID as the parcel id instead of skipping every row
      const pid = clean(p.Prop_ID) || (process.env.TX_ID_FALLBACK === 'geo' ? clean(p.GEO_ID) : null);
      if (!pid) { stat.noId++; continue; }
      if (!r.value.geometry) { stat.noGeom++; continue; }
      let key = `TX-${county}-${pid}`; const n = (seen.get(pid) || 0) + 1; seen.set(pid, n);
      if (n > 1) { key += `-D${n}`; stat.dupSuffixed++; }
      const lu = landUse(p.STAT_LAND_);
      const ac = acres(p), land = num(p.LAND_VALUE), imp = num(p.IMP_VALUE), yb = Number(p.YEAR_BUILT) > 1700 ? Number(p.YEAR_BUILT) : null;
      const mailZip = clean(p.MAIL_ZIP);
      const row = {
        parcel_key: key, parcel_key_local: `${county}-${pid}`, county: clean(p.COUNTY) ? clean(p.COUNTY).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null, co_no: Number(county),
        parcel_id: pid, alt_key: clean(p.GEO_ID),
        own_name: clean(p.OWNER_NAME), own_addr1: clean(p.MAIL_LINE1) || mailStreet(p.MAIL_ADDR), own_addr2: clean(p.MAIL_LINE2), own_city: clean(p.MAIL_CITY), own_state: clean(p.MAIL_STAT), own_zipcd: mailZip,
        phy_addr1: streetLine(p), phy_city: clean(p.SITUS_CITY) || (/,\s*([^,]+),\s*TX\b/i.exec(String(p.SITUS_ADDR || '')) || [])[1]?.trim() || null, phy_zipcd: clean(p.SITUS_ZIP),
        acreage: ac, use_code: lu.code, use_desc: lu.desc, jv: num(p.MKT_VALUE), land_value: land, improvement_value: imp, year_built: yb,
        likely_vacant: lu.vacant, source_revised: toDate(p.DATE_ACQ),
        geometry: JSON.stringify({ type: r.value.geometry.type, coordinates: round7(r.value.geometry.coordinates) }),
      };
      if (lu.code) stat.use++; if (ac) stat.acres++; if (row.own_name) stat.own++; if (row.jv) stat.jv++;
      buf.push(row);
      if (buf.length >= BATCH) await flush();
      if (LIMIT && stat.loaded + buf.length >= LIMIT) break;
      if (stat.read % 100000 === 0) console.log(`  ${stat.read} read, ${stat.loaded} loaded, ${Math.round((Date.now() - t0) / 1000)}s`);
    }
    if (LIMIT && stat.loaded + buf.length >= LIMIT) break;
  }
  await flush();
  await pool.query(`UPDATE public.${table} SET latitude = ST_Y(ST_PointOnSurface(geom)), longitude = ST_X(ST_PointOnSurface(geom)) WHERE co_no = $1 AND latitude IS NULL`, [Number(county)]);
  // No class code on a parcel: call it likely vacant only if it is land-only (land value, no building value, no year built) AND this
  // county reliably reports building values (>= 30% of its parcels have one). Otherwise stays unknown (NULL), never guessed.
  const fb = await pool.query(`UPDATE public.${table} SET likely_vacant = true
    WHERE co_no = $1 AND use_code IS NULL AND land_value > 0 AND improvement_value IS NULL AND year_built IS NULL
      AND (SELECT count(improvement_value)::float / NULLIF(count(*), 0) FROM public.${table} WHERE co_no = $1) >= 0.3`, [Number(county)]);
  console.log(`  value-based vacant fallback marked ${fb.rowCount}`);
  const pct = (x) => (stat.loaded ? (100 * x / stat.loaded).toFixed(1) + '%' : '-');
  console.log(`county ${county}: ${stat.loaded} loaded of ${stat.read} rows in ${Math.round((Date.now() - t0) / 1000)}s | skipped no-ID ${stat.noId}, no-shape ${stat.noGeom}, renumbered duplicates ${stat.dupSuffixed}`);
  console.log(`  fill: owner ${pct(stat.own)}, acres ${pct(stat.acres)}, land-use ${pct(stat.use)}, market value ${pct(stat.jv)}`);
  const s = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('public.${table}')) sz, (SELECT count(*) FROM public.${table}) n`);
  console.log('table', table, JSON.stringify(s.rows[0]));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
