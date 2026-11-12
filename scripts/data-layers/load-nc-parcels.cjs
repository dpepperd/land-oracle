// Load NC OneMap statewide parcels (polygons, layer 1) into a staging table shaped like Florida's parcels_current_all.
// Source: https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1 (free, "unrestricted use"; see docs/nc-onemap-terms-2026-11-11.md)
// Usage: node scripts/data-layers/load-nc-parcels.cjs <table> <cntyfips3,...>   e.g. nc_parcels_stage 055
// Safe to re-run: a county already loaded with the same parcel count as the source is skipped; otherwise it is deleted and reloaded.
// Read-only against NC OneMap. Writes only to the named table.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const SRC = 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query';
const PAGE = 1000;
const table = process.argv[2];
const fips = (process.argv[3] || '').split(',').filter(Boolean);
if (!/^[a-z_]+$/.test(table || '') || fips.length === 0) { console.error('usage: <table> <cntyfips3,...>'); process.exit(1); }

const FIELDS = 'objectid,parno,altparno,ownname,mailadd,munit,mcity,mstate,mzip,siteadd,sunit,scity,szip,parval,landval,improvval,gisacres,struct,structyear,saledate,parusecode,parusedesc,owntype,cntyname,cntyfips,revisedate,sourcedate';

async function post(params) {
  const body = new URLSearchParams(params);
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(SRC, { method: 'POST', body, signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) { if (a === 3) throw e; await new Promise((s) => setTimeout(s, 2000 * a)); }
  }
}

// Gentle mode: pause between pages and slow down whenever a normal site query gets slow (the live site shares this database).
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 250);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const probeSql = "SELECT count(*) FROM parcels_current_all p WHERE p.county = 'Duval' AND p.jv >= 2000000";
async function probe() { const t = Date.now(); await pool.query(probeSql); return Date.now() - t; }
let baseline = null, pages = 0;
async function gentle() {
  await sleep(THROTTLE_MS);
  if (++pages % 10 !== 0) return;
  if (baseline === null) { const a = []; for (let i = 0; i < 3; i++) a.push(await probe()); a.sort((x, y) => x - y); baseline = Math.max(a[1], 50); console.log('  baseline search probe ms:', baseline); return; }
  let t = await probe(), waited = 0;
  while (t > Math.max(baseline * 3, 1500) && waited < 600000) { console.log('  site probe slow (' + t + 'ms vs ' + baseline + '), pausing 30s'); await sleep(30000); waited += 30000; t = await probe(); }
}

const clean = (v) => { if (v === null || v === undefined) return null; const s = String(v).replace(/\s+/g, ' ').trim(); return s === '' ? null : s; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const titleCase = (s) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);
const toDate = (ms) => { const n = Number(ms); if (!Number.isFinite(n) || n <= 0) return null; const d = new Date(n); const y = d.getUTCFullYear(); return y >= 1900 && y <= 2100 ? d.toISOString().slice(0, 10) : null; };

// "1905 WOODSTOCK RD STE 9250 30075" with mzip 30075 -> street without the trailing zip
function mailStreet(addr, zip) {
  let a = clean(addr); if (!a) return null;
  const z = clean(zip);
  if (z) { const z5 = z.slice(0, 5); if (a.endsWith(' ' + z5) || a.endsWith(' ' + z)) a = a.slice(0, a.lastIndexOf(' ')).trim(); }
  return a || null;
}

function mapRow(ft, fipsCode) {
  const p = ft.properties || {};
  const parno = clean(p.parno) || ('OID' + p.objectid);
  const improv = num(p.improvval), landv = num(p.landval), total = num(p.parval);
  const structYear = Number(p.structyear) > 1700 ? Number(p.structyear) : null;
  const hasStruct = ['Y', '1', 'YES'].includes(String(p.struct || '').toUpperCase());
  const likelyVacant = (landv || total) && !improv && !structYear && !hasStruct ? true : false;
  const mzip = clean(p.mzip);
  return {
    parcel_key: `NC-${fipsCode}-${parno}`, parcel_key_local: `${fipsCode}-${parno}`,
    county: titleCase(clean(p.cntyname)), co_no: Number(fipsCode), parcel_id: parno, alt_key: clean(p.altparno),
    own_name: clean(p.ownname), own_addr1: mailStreet(p.mailadd, p.mzip), own_addr2: clean(p.munit), own_city: clean(p.mcity), own_state: clean(p.mstate), own_zipcd: mzip,
    phy_addr1: clean(p.siteadd), phy_addr2: clean(p.sunit), phy_city: clean(p.scity), phy_zipcd: clean(p.szip),
    acreage: Number(p.gisacres) > 0 ? Number(p.gisacres) : null,
    use_code: clean(p.parusecode), use_desc: clean(p.parusedesc), owner_type: clean(p.owntype),
    jv: total, land_value: landv, improvement_value: improv, year_built: structYear,
    sale1_date: toDate(p.saledate), likely_vacant: likelyVacant, source_revised: toDate(p.revisedate) || toDate(p.sourcedate),
    geometry: ft.geometry,
  };
}

const COLS = ['parcel_key', 'parcel_key_local', 'county', 'co_no', 'parcel_id', 'alt_key', 'own_name', 'own_addr1', 'own_addr2', 'own_city', 'own_state', 'own_zipcd',
  'phy_addr1', 'phy_addr2', 'phy_city', 'phy_zipcd', 'acreage', 'use_code', 'use_desc', 'owner_type', 'jv', 'land_value', 'improvement_value', 'year_built', 'sale1_date', 'likely_vacant', 'source_revised'];

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.${table} (
    gid bigserial PRIMARY KEY, state char(2) NOT NULL DEFAULT 'NC', parcel_key text NOT NULL, parcel_key_local text, county text, co_no smallint,
    parcel_id text, alt_key text, own_name text, own_addr1 text, own_addr2 text, own_city text, own_state text, own_zipcd text,
    phy_addr1 text, phy_addr2 text, phy_city text, phy_zipcd text, acreage numeric, use_code text, use_desc text, owner_type text,
    jv bigint, land_value bigint, improvement_value bigint, year_built smallint, sale1_date date, likely_vacant boolean, source_revised date,
    latitude double precision, longitude double precision, geom geometry(MultiPolygon, 4326), loaded_at timestamptz DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_geom_gix ON public.${table} USING gist (geom)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_cty ON public.${table} (co_no)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_key ON public.${table} (parcel_key)`);

  for (const f of fips) {
    // The state stores most county codes padded ('055') but a few unpadded ('43' Clay, '5' Alleghany): match both.
    const where = `cntyfips IN ('${f}','${String(Number(f))}')`;
    const want = (await post({ where, returnCountOnly: 'true', f: 'json' })).count;
    const have = Number((await pool.query(`SELECT count(*) n FROM public.${table} WHERE co_no = $1`, [Number(f)])).rows[0].n);
    if (want && have === want) { console.log(`county ${f}: already complete (${have}), skipped`); continue; }
    await pool.query(`DELETE FROM public.${table} WHERE co_no = $1`, [Number(f)]);
    let lastOid = -1, total = 0, size = PAGE, skipped = 0; const t = Date.now();
    for (;;) {
      let j;
      try { j = await post({ where: `${where} AND objectid > ${lastOid}`, outFields: FIELDS, returnGeometry: 'true', outSR: '4326', orderByFields: 'objectid', resultRecordCount: String(size), f: 'geojson' }); }
      catch (e) {
        if (size > 1) { size = Math.max(1, Math.floor(size / 5)); continue; }
        console.log(`  skipped one record after objectid ${lastOid}: ${e.message}`); skipped++; lastOid += 1; size = PAGE; continue;
      }
      const feats = (j.features || []).filter((x) => x.geometry);
      const raw = j.features || [];
      if (!raw.length) break;
      const rows = feats.map((x) => mapRow(x, f));
      if (rows.length) {
        const vals = [], ph = [];
        rows.forEach((r, i) => {
          const b = i * (COLS.length + 1);
          ph.push(`(${COLS.map((_, k) => `$${b + k + 1}`).join(',')},ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${b + COLS.length + 1}),4326)),3)))`);
          COLS.forEach((c) => vals.push(r[c] === undefined ? null : r[c])); vals.push(JSON.stringify(r.geometry));
        });
        await pool.query(`INSERT INTO public.${table} (${COLS.join(',')},geom) VALUES ${ph.join(',')}`, vals);
      }
      total += rows.length;
      await gentle();
      lastOid = Math.max(...raw.map((x) => Number(x.properties.objectid)));
      if (raw.length < size) break;
      if (size < PAGE) size = Math.min(PAGE, size * 2);
    }
    await pool.query(`UPDATE public.${table} SET latitude = ST_Y(ST_PointOnSurface(geom)), longitude = ST_X(ST_PointOnSurface(geom)) WHERE co_no = $1 AND latitude IS NULL`, [Number(f)]);
    console.log(`county ${f}: ${total} of ${want} parcels in ${Math.round((Date.now() - t) / 1000)}s${skipped ? ' SKIPPED ' + skipped : ''}`);
  }
  const s = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('public.${table}')) sz, (SELECT count(*) FROM public.${table}) n`);
  console.log('table', table, JSON.stringify(s.rows[0]));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
