// READ-ONLY. Compares parcels.own_name against OWN_NAME in each county's source
// shapefile attribute table (.dbf) to find rows that look manually edited
// (e.g. via PATCH /api/parcels/[id]) or otherwise diverge from source.
// Usage: node scripts/parcels-v2/diff-own-name.js <out.json>
const fs = require('fs'), path = require('path');
const shapefile = require('shapefile');
const { Client } = require('pg');
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const BASE = 'D:/LandOracle/Florida';
const nk = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nn = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false },
    options: '-c default_transaction_read_only=on -c statement_timeout=600000' });
  await c.connect();
  const out = {};
  const dirs = fs.readdirSync(BASE).filter((d) => fs.statSync(path.join(BASE, d)).isDirectory()).sort();
  for (const county of dirs) {
    const dbfs = [];
    for (const sub of ['gis', 'gis_condos']) {
      const dir = path.join(BASE, county, sub);
      if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/\.dbf$/i.test(f)) dbfs.push(path.join(dir, f));
    }
    const src = new Map(); let srcRows = 0, hasOwnField = false;
    for (const f of dbfs) {
      const s = await shapefile.openDbf(f);
      while (true) {
        const r = await s.read(); if (r.done) break;
        srcRows++;
        const p = r.value; if ('OWN_NAME' in p) hasOwnField = true;
        for (const key of [p.PARCEL_ID, p.PARCELNO]) { const k = nk(key); if (k && !src.has(k)) src.set(k, p.OWN_NAME ?? null); }
      }
    }
    const rows = (await c.query('select parcel_id, parcelno, own_name from parcels where county=$1', [county])).rows;
    const st = { dbf_files: dbfs.length, src_rows: srcRows, has_own_name_field: hasOwnField, db_rows: rows.length,
      matched: 0, not_found: 0, same: 0, db_blank_src_has: 0, db_has_src_blank: 0, differ: 0, samples: [] };
    for (const r of rows) {
      let hit, found = false;
      for (const key of [r.parcel_id, r.parcelno]) { const k = nk(key); if (k && src.has(k)) { hit = src.get(k); found = true; break; } }
      if (!found) { st.not_found++; continue; }
      st.matched++;
      const a = nn(r.own_name), b = nn(hit);
      if (a === b) st.same++;
      else if (!a && b) st.db_blank_src_has++;
      else if (a && !b) st.db_has_src_blank++;
      else { st.differ++; if (st.samples.length < 8) st.samples.push({ parcel: r.parcel_id || r.parcelno, db: r.own_name, src: hit }); }
    }
    out[county] = st; console.error('ok', county, JSON.stringify({ m: st.matched, same: st.same, differ: st.differ }));
    fs.writeFileSync(process.argv[2], JSON.stringify(out));
  }
  await c.end(); console.error('ALLDONE');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
