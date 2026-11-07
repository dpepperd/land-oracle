// READ-ONLY. Second pass of diff-own-name.js. For counties whose DB own_name differs from the
// source shapefile, also compares against the DOR NAL CSV and classifies each differing row:
//   equals_nal : DB matches NAL (the shapefile is just a different vintage)
//   neither    : DB matches neither source  -> real manual-edit / corruption candidates
//   not_in_nal : parcel not found in the NAL file
// Usage: node scripts/parcels-v2/diff-own-name-nal.js <pass1.json> <out.json>
const fs = require('fs'), path = require('path');
const shapefile = require('shapefile');
const csv = require('csv-parser');
const { Client } = require('pg');
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const BASE = 'D:/LandOracle/Florida';
const nk = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nn = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
const pass1 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false },
    options: '-c default_transaction_read_only=on -c statement_timeout=600000' });
  await c.connect();
  const out = {};
  for (const county of Object.keys(pass1).filter((k) => pass1[k].differ > 0)) {
    const dbf = new Map();
    for (const sub of ['gis', 'gis_condos']) {
      const dir = path.join(BASE, county, sub);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) if (/\.dbf$/i.test(f)) {
        const s = await shapefile.openDbf(path.join(dir, f));
        while (true) { const r = await s.read(); if (r.done) break;
          for (const key of [r.value.PARCEL_ID, r.value.PARCELNO]) { const k = nk(key); if (k && !dbf.has(k)) dbf.set(k, r.value.OWN_NAME ?? null); } }
      }
    }
    const nalFile = fs.readdirSync(path.join(BASE, county)).find((f) => /^NAL.*\.csv$/i.test(f));
    const nal = new Map();
    if (nalFile) await new Promise((res, rej) => fs.createReadStream(path.join(BASE, county, nalFile)).pipe(csv())
      .on('data', (r) => { const k = nk(r.PARCEL_ID); if (k && !nal.has(k)) nal.set(k, r.OWN_NAME ?? null); }).on('end', res).on('error', rej));
    const rows = (await c.query('select parcel_id, parcelno, own_name from parcels where county=$1', [county])).rows;
    const st = { nal_file: nalFile || null, differ_from_dbf: 0, equals_nal: 0, neither: 0, not_in_nal: 0, samples: [] };
    for (const r of rows) {
      let d, found = false;
      for (const key of [r.parcel_id, r.parcelno]) { const k = nk(key); if (k && dbf.has(k)) { d = dbf.get(k); found = true; break; } }
      if (!found) continue;
      const a = nn(r.own_name), b = nn(d);
      if (!a || !b || a === b) continue;                 // only rows that differ from the shapefile
      st.differ_from_dbf++;
      let nv, nf = false;
      for (const key of [r.parcel_id, r.parcelno]) { const k = nk(key); if (k && nal.has(k)) { nv = nal.get(k); nf = true; break; } }
      if (!nf) { st.not_in_nal++; continue; }
      if (nn(nv) === a) st.equals_nal++;
      else { st.neither++; if (st.samples.length < 6) st.samples.push({ parcel: r.parcel_id || r.parcelno, db: r.own_name, dbf: d, nal: nv }); }
    }
    out[county] = st; console.error('ok', county, JSON.stringify({ d: st.differ_from_dbf, nal: st.equals_nal, neither: st.neither }));
    fs.writeFileSync(process.argv[3], JSON.stringify(out));
  }
  await c.end(); console.error('ALLDONE');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
