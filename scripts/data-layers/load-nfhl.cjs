// Load FEMA NFHL flood hazard polygons (layer 28, S_FLD_HAZ_AR) for Florida counties into a staging table.
// Usage: node scripts/data-layers/load-nfhl.cjs <table> <fips5,fips5,...>   e.g. flood_nfhl_stage 12019,12031,12087
// Safe to re-run: each county is deleted and reloaded. One geometry column (4326, simplified to ~2 m, made valid; keeps size ~10x smaller). Read-only against FEMA.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const SRC = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';
const PAGE = 250;
const table = process.argv[2];
const fips = (process.argv[3] || '').split(',').filter(Boolean);
if (!/^[a-z_]+$/.test(table || '') || fips.length === 0) { console.error('usage: <table> <fips,...>'); process.exit(1); }

async function page(where, offset, size = PAGE) {
  const body = new URLSearchParams({
    where, outFields: 'FLD_AR_ID,DFIRM_ID,FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH,VELOCITY',
    returnGeometry: 'true', outSR: '4326', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(size), f: 'geojson',
  });
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(SRC, { method: 'POST', body, signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.features || [];
    } catch (e) { if (a === 3) throw e; await new Promise((s) => setTimeout(s, 2000 * a)); }
  }
}

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.${table} (
    id bigserial PRIMARY KEY, county_fips text, dfirm_id text, fld_ar_id text, fld_zone text, zone_subty text, sfha_tf text,
    static_bfe double precision, depth double precision, velocity double precision,
    geom geometry(Geometry, 4326), loaded_at timestamptz DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_geom_gix ON public.${table} USING gist (geom)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_cty ON public.${table} (county_fips)`);
  for (const f of fips) {
    // Resume support: skip a county that is already fully loaded (same polygon count as FEMA)
    try {
      const cr = await fetch(SRC, { method: 'POST', body: new URLSearchParams({ where: `DFIRM_ID LIKE '${f}%'`, returnCountOnly: 'true', f: 'json' }), signal: AbortSignal.timeout(60000) });
      const want = (await cr.json()).count;
      const have = Number((await pool.query(`SELECT count(*) n FROM public.${table} WHERE county_fips = $1`, [f])).rows[0].n);
      if (want && have === want) { console.log(`county ${f}: already complete (${have}), skipped`); continue; }
    } catch (e) { /* if the check fails, just reload the county */ }
    await pool.query(`DELETE FROM public.${table} WHERE county_fips = $1`, [f]);
    let off = 0, total = 0, size = PAGE, skipped = 0; const t = Date.now();
    for (;;) {
      let feats;
      try { feats = await page(`DFIRM_ID LIKE '${f}%'`, off, size); }
      catch (e) {
        if (size > 1) { size = Math.max(1, Math.floor(size / 5)); continue; } // FEMA 500s on heavy shapes: shrink the page
        console.log(`  skipped record at offset ${off} in ${f}: ${e.message}`); skipped++; off += 1; size = PAGE; continue;
      }
      if (!feats.length) break;
      const vals = [], ph = [];
      feats.forEach((ft, i) => {
        const p = ft.properties || {}, b = i * 10;
        ph.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(ST_SetSRID(ST_GeomFromGeoJSON($${b+10}),4326),0.00002)),3)))`);
        vals.push(f, p.DFIRM_ID, p.FLD_AR_ID, p.FLD_ZONE, p.ZONE_SUBTY, p.SFHA_TF, p.STATIC_BFE, p.DEPTH, p.VELOCITY, JSON.stringify(ft.geometry));
      });
      await pool.query(`INSERT INTO public.${table} (county_fips,dfirm_id,fld_ar_id,fld_zone,zone_subty,sfha_tf,static_bfe,depth,velocity,geom) VALUES ${ph.join(',')}`, vals);
      total += feats.length; off += feats.length;
      if (feats.length < size) break;
      if (size < PAGE) size = Math.min(PAGE, size * 2);
    }
    console.log(`county ${f}: ${total} polygons in ${Math.round((Date.now() - t) / 1000)}s${skipped ? ' SKIPPED ' + skipped : ''}`);
  }
  const s = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size('public.${table}')) sz, (SELECT count(*) FROM public.${table}) n`);
  console.log('table', table, JSON.stringify(s.rows[0]));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
