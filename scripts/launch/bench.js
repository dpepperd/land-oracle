// Benchmarks the app's query shapes against parcels_current / parcels_current_all (read-only).
//   node scripts/launch/bench.js [--only Clay]
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const BOX = { Clay: [-81.80, 30.05, -81.70, 30.15], Duval: [-81.75, 30.25, -81.55, 30.40], 'Miami-Dade': [-80.30, 25.70, -80.18, 25.82] };
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, options: '-c default_transaction_read_only=on -c statement_timeout=120000' });
  await c.connect();
  const out = [];
  for (const county of Object.keys(BOX).filter((k) => !only || k === only)) {
    const [x1, y1, x2, y2] = BOX[county];
    const t = async (name, sql, params) => {
      const t0 = Date.now(); let n = '', err = '';
      try { const r = await c.query(sql, params); n = r.rowCount; if (r.rows[0] && r.rows[0].n !== undefined) n = r.rows[0].n; } catch (e) { err = e.message.slice(0, 60); }
      const ms = Date.now() - t0; out.push({ county, name, ms, rows: n, err }); console.log(county.padEnd(11), name.padEnd(34), String(ms).padStart(6) + 'ms', String(n).padStart(8), err);
    };
    const cols = `p.gid as id, p.county, p.parcel_key, p.parcel_id, p.parcelno, p.alt_key, p.own_name as owner_name, p.own_addr1 as owner_address, p.own_city as owner_city, p.own_state as owner_state, p.own_zipcd as owner_zip, p.acreage, p.dor_uc as land_use, COALESCE(p.phy_addr1, p.own_addr1) as property_address, p.jv as market_value, (p.own_state != 'FL' AND p.own_state IS NOT NULL) as out_of_state, p.latitude, p.longitude`;
    await t('search: SFR 1-10ac jv<=1M (list+geojson)', `SELECT ${cols}, ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson FROM parcels_current p WHERE p.county = $1 AND p.dor_uc = ANY($2) AND p.acreage BETWEEN 1 AND 10 AND p.jv BETWEEN 50000 AND 1000000 LIMIT 500`, [county, ['001']]);
    await t('search: out-of-state owners, limit 500', `SELECT ${cols} FROM parcels_current p WHERE p.county = $1 AND p.own_state != 'FL' AND p.own_state IS NOT NULL LIMIT 500`, [county]);
    await t('search: address ILIKE', `SELECT ${cols} FROM parcels_current p WHERE p.county = $1 AND (p.phy_addr1 ILIKE $2 OR p.own_addr1 ILIKE $2) LIMIT 100`, [county, '%MAIN ST%']);
    await t('search: parcel id ILIKE', `SELECT ${cols} FROM parcels_current p WHERE p.county = $1 AND p.parcelno ILIKE $2 LIMIT 100`, [county, '%0012%']);
    await t('search: bbox viewport (map)', `SELECT ${cols}, ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson FROM parcels_current p WHERE p.county = $1 AND p.geom && ST_MakeEnvelope($2,$3,$4,$5,4326) AND ST_Intersects(ST_PointOnSurface(p.geom), ST_MakeEnvelope($2,$3,$4,$5,4326)) LIMIT 2000`, [county, x1, y1, x2, y2]);
    await t('search incl. NAL-only (_all)', `SELECT ${cols} FROM parcels_current_all p WHERE p.county = $1 AND p.dor_uc = ANY($2) AND p.jv BETWEEN 50000 AND 1000000 LIMIT 500`, [county, ['001']]);
    await t('count: SFR in county', `SELECT count(*)::int AS n FROM parcels_current p WHERE p.county = $1 AND p.dor_uc = '001'`, [county]);
    await t('export: 5000 rows SFR filtered', `SELECT p.county, p.parcel_id, p.alt_key, p.own_name, p.own_addr1, p.own_city, p.own_state, p.own_zipcd, p.acreage, p.dor_uc, p.phy_addr1, p.jv, p.latitude, p.longitude FROM parcels_current_all p WHERE p.county = $1 AND p.dor_uc = ANY($2) AND p.jv > 100000 LIMIT 5000`, [county, ['001']]);
    const k = (await c.query(`SELECT parcel_key_local FROM parcels_current WHERE county = $1 AND dor_uc = '001' LIMIT 1 OFFSET 1000`, [county])).rows[0]?.parcel_key_local;
    await t('popup: lookup by parcel_key', `SELECT * FROM parcels_current p WHERE p.county = $1 AND p.parcel_key_local = $2`, [county, k]);
  }
  fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'bench_last.json'), JSON.stringify(out));
  const slow = out.filter((r) => r.ms > 2000 || r.err); console.log('\nslow/err (>2s):', slow.length); slow.forEach((r) => console.log(' ', r.county, r.name, r.ms + 'ms', r.err));
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
