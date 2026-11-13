// Tarrant (439): our parcel_id is the tax-parcel number (e.g. 47830-6-6); TAD's property pages need its account number (PID).
// TAD publishes both on its public ArcGIS layer. This pages through that layer and writes the PID into parcels_tx.alt_key
// for county 439 (only rows where alt_key is empty). Safe to re-run. Usage: node scripts/data-layers/tx-tarrant-pid.cjs
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const L = 'https://tad.newedgeservices.com/arcgis/rest/services/InteractiveMap/TADMap/MapServer/0/query';
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 900000 });
async function page(offset, n) {
  const q = new URLSearchParams({ where: '1=1', outFields: 'PID,TAXPIN', returnGeometry: 'false', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(n), f: 'json' });
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(`${L}?${q}`, { signal: AbortSignal.timeout(60000) }); const j = await r.json(); if (j.features) return j; } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
  }
  throw new Error('page failed at offset ' + offset);
}
(async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS public.tx_tarrant_pid (taxpin text PRIMARY KEY, pid bigint NOT NULL)');
  await pool.query('TRUNCATE public.tx_tarrant_pid');
  let offset = 0, total = 0; const N = 1000;
  for (;;) {
    const j = await page(offset, N);
    const f = j.features.map((x) => x.attributes).filter((a) => a.TAXPIN && a.PID);
    if (f.length) {
      const seen = new Map(); f.forEach((a) => seen.set(a.TAXPIN, a.PID));
      await pool.query('INSERT INTO public.tx_tarrant_pid (taxpin, pid) SELECT * FROM unnest($1::text[], $2::bigint[]) ON CONFLICT (taxpin) DO NOTHING', [[...seen.keys()], [...seen.values()]]);
    }
    total += j.features.length; offset += j.features.length;
    if (offset % 50000 < N) console.log('fetched', offset);
    if (!j.exceededTransferLimit && j.features.length < N) break;
    if (!j.features.length) break;
  }
  const c = (await pool.query('select count(*) n from public.tx_tarrant_pid')).rows[0].n;
  console.log('layer rows', total, 'distinct taxpin stored', c);
  const u = await pool.query(`UPDATE public.parcels_tx p SET alt_key = t.pid::text FROM public.tx_tarrant_pid t WHERE p.co_no = 439 AND p.parcel_id = t.taxpin AND p.alt_key IS NULL`);
  console.log('parcels_tx rows given a TAD account:', u.rowCount);
  const m = (await pool.query(`select count(*) filter (where alt_key is not null) with_pid, count(*) total from public.parcels_tx where co_no=439`)).rows[0];
  console.log('Tarrant coverage', JSON.stringify(m));
  await pool.query('GRANT SELECT ON public.tx_tarrant_pid TO landoracle_prod').catch(() => {});
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
