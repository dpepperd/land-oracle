// READ-ONLY match report: staging.nal_<year> / sdf_<year> vs parcels_v2. Writes JSON + markdown. Parcel IDs only (no owner data).
//   node scripts/dor/match-report.js --year 2026 --out phase2-match-report.md
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const year = arg('year', '2026'), out = arg('out', 'phase2-match-report.md');
const root = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const NAL = `staging.nal_${year}`, SDF = `staging.sdf_${year}`;
const exm = Array.from({ length: 48 }, (_, i) => 'coalesce(n.exmpt_' + String(i + 1).padStart(2, '0') + ',0)>0').join(' OR ');
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : '-');

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, options: '-c default_transaction_read_only=on -c statement_timeout=0' });
  await c.connect();
  const counties = (await c.query(`select cc.co_no, cc.name, (select roll_stage from ${NAL} where co_no=cc.co_no limit 1) stage from county_codes cc order by 1`)).rows;
  const res = [];
  for (const { co_no, name, stage } of counties) {
    const m = (await c.query(`
      WITH v AS (SELECT match_key FROM parcels_v2 WHERE co_no=$1 AND match_key IS NOT NULL GROUP BY 1)
      SELECT count(*)::int nal_rows, count(DISTINCT n.match_key)::int nal_keys,
        count(v.match_key)::int matched,
        count(*) FILTER (WHERE n.match_key IS NULL)::int nal_nokey,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.own_name,'')<>'')::int f_owner,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.own_addr1,'')<>'')::int f_mail,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.phy_addr1,'')<>'')::int f_situs,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.jv,0)>0)::int f_jv,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.lnd_sqfoot,0)>0)::int f_acre,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.dor_uc,'')<>'')::int f_use,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND (${exm}))::int f_exempt,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND coalesce(n.sale_prc1,0)>0)::int f_sale_prc,
        count(*) FILTER (WHERE v.match_key IS NOT NULL AND n.sale_yr1 IS NOT NULL AND n.sale_mo1 IS NOT NULL)::int f_sale_dt
      FROM ${NAL} n LEFT JOIN v ON v.match_key = n.match_key WHERE n.co_no=$1`, [co_no])).rows[0];
    const v2 = (await c.query(`
      SELECT count(*)::int v2_rows, count(*) FILTER (WHERE match_key IS NULL)::int v2_nokey,
        count(*) FILTER (WHERE match_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${NAL} n WHERE n.co_no=$1 AND n.match_key=p.match_key))::int v2_only
      FROM parcels_v2 p WHERE co_no=$1`, [co_no])).rows[0];
    const sdf = (await c.query(`
      WITH v AS (SELECT match_key FROM parcels_v2 WHERE co_no=$1 AND match_key IS NOT NULL GROUP BY 1)
      SELECT count(*)::int sdf_rows, count(v.match_key)::int sdf_matched,
        count(DISTINCT s.match_key) FILTER (WHERE v.match_key IS NOT NULL)::int sdf_parcels_matched
      FROM ${SDF} s LEFT JOIN v ON v.match_key=s.match_key WHERE s.co_no=$1`, [co_no])).rows[0];
    const sNal = (await c.query(`SELECT n.parcel_id FROM ${NAL} n WHERE n.co_no=$1 AND n.match_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parcels_v2 p WHERE p.co_no=$1 AND p.match_key=n.match_key) LIMIT 5`, [co_no])).rows.map((r) => r.parcel_id);
    const sV2 = (await c.query(`SELECT p.parcel_id FROM parcels_v2 p WHERE p.co_no=$1 AND p.match_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${NAL} n WHERE n.co_no=$1 AND n.match_key=p.match_key) LIMIT 5`, [co_no])).rows.map((r) => r.parcel_id);
    res.push({ co_no, name, stage, ...m, ...v2, ...sdf, nal_only: m.nal_rows - m.matched, sample_nal_only: sNal, sample_v2_only: sV2 });
    console.error('ok', name, pct(m.matched, m.nal_rows));
  }
  fs.writeFileSync(path.join(root, 'data', 'dor', year, 'match_report.json'), JSON.stringify(res));
  const T = (f) => res.reduce((a, r) => a + (r[f] || 0), 0);
  let md = `# Phase 2 match report: DOR ${year} NAL/SDF vs parcels_v2\n\nGenerated read-only. Match = NAL \`match_key\` (strict alphanumeric PARCEL_ID) found in \`parcels_v2.match_key\` for the same county. Samples are parcel IDs only.\n\n`;
  md += `**Totals:** NAL rows ${T('nal_rows')}, v2 rows ${T('v2_rows')}, matched ${T('matched')} (${pct(T('matched'), T('nal_rows'))}% of NAL), NAL-only ${T('nal_only')}, v2-only ${T('v2_only')} (v2 rows without key: ${T('v2_nokey')}).\n\n`;
  md += `| Co | County | Stage | NAL rows | v2 rows | Matched | NAL-only | v2-only | NAL match % | v2 match % | SDF rows | SDF match % |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of res) {
    const np = pct(r.matched, r.nal_rows), vp = pct(r.v2_rows - r.v2_only - r.v2_nokey, r.v2_rows);
    md += `| ${r.co_no} | ${r.name} | ${r.stage} | ${r.nal_rows} | ${r.v2_rows} | ${r.matched} | ${r.nal_only} | ${r.v2_only} | ${np}${Number(np) < 98 ? ' ⚠' : ''} | ${vp}${Number(vp) < 98 ? ' ⚠' : ''} | ${r.sdf_rows} | ${pct(r.sdf_matched, r.sdf_rows)} |\n`;
  }
  md += `\n## Fill rates among matched NAL rows (hypothetical join)\n\n| County | owner | mail addr | situs addr | JV>0 | land sqft>0 | use code | any exemption | sale price>0 | sale yr+mo |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of res) md += `| ${r.name} | ${pct(r.f_owner, r.matched)} | ${pct(r.f_mail, r.matched)} | ${pct(r.f_situs, r.matched)} | ${pct(r.f_jv, r.matched)} | ${pct(r.f_acre, r.matched)} | ${pct(r.f_use, r.matched)} | ${pct(r.f_exempt, r.matched)} | ${pct(r.f_sale_prc, r.matched)} | ${pct(r.f_sale_dt, r.matched)} |\n`;
  const low = res.filter((r) => Number(pct(r.matched, r.nal_rows)) < 98 || Number(pct(r.v2_rows - r.v2_only - r.v2_nokey, r.v2_rows)) < 98);
  md += `\n## Counties below 98% (either direction): ${low.length}\n\n`;
  for (const r of low) md += `### ${r.name} (${r.co_no}, stage ${r.stage})\n- NAL match ${pct(r.matched, r.nal_rows)}%, v2 match ${pct(r.v2_rows - r.v2_only - r.v2_nokey, r.v2_rows)}%\n- NAL-only sample: ${r.sample_nal_only.join(', ') || '-'}\n- v2-only sample: ${r.sample_v2_only.join(', ') || '-'}\n\n`;
  fs.writeFileSync(path.join(root, out), md); console.error('wrote', out, 'low', low.length); await c.end();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
