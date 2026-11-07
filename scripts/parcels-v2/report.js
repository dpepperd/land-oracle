// READ-ONLY. Produces parcels-v2-build-report.md from the live DB (+ the own_name diff json).
//   node scripts/parcels-v2/report.js <ownname_diff.json> <out.md>
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const root = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[^&]*/, '');
const n = (x) => Number(x).toLocaleString('en-US');

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false },
    options: '-c default_transaction_read_only=on -c statement_timeout=0' });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const L = [];
  const out = (s = '') => L.push(s);

  const perCounty = await q(`
    with v1 as (select county, count(*) n1 from parcels group by 1),
    v2 as (select county, count(*) n2, sum(cardinality(v1_gids)) covered,
             count(*) filter (where quarantine) quar,
             count(*) filter (where needs_review and not quarantine) review,
             count(*) filter (where note like 'merged_identical_attrs%' or note like 'duval_split_merged%') merged_rows,
             coalesce(sum(cardinality(v1_gids)-1) filter (where cardinality(v1_gids)>1),0) merged_away,
             count(*) filter (where note like 'collision_suffixed%') suffixed
           from parcels_v2 group by 1)
    select v1.county, n1, coalesce(n2,0) n2, coalesce(covered,0) covered, coalesce(quar,0) quar, coalesce(review,0) review,
           coalesce(merged_rows,0) merged_rows, coalesce(merged_away,0) merged_away, coalesce(suffixed,0) suffixed
    from v1 left join v2 using (county) order by v1.county`);
  const T = perCounty.reduce((a, r) => { for (const k of Object.keys(r)) if (k !== 'county') a[k] = (a[k] || 0) + Number(r[k]); return a; }, {});

  out('# parcels_v2 build report');
  out();
  out(`Generated ${new Date().toISOString().slice(0, 10)} from the live database. v1 (\`parcels\`) was not modified; nothing swapped or dropped.`);
  out();
  out('## 1. Row counts, v2 vs v1');
  out();
  out(`**v1 ${n(T.n1)} rows → v2 ${n(T.n2)} rows** (${n(T.merged_away)} rows folded away by merges; every v1 gid is covered exactly once: covered=${n(T.covered)}${T.covered === T.n1 ? ' ✓' : ' ✗ MISMATCH'}).`);
  out();
  out('| County | v1 | v2 | merged away | suffixed rows | quarantined | other needs_review |');
  out('|---|---:|---:|---:|---:|---:|---:|');
  for (const r of perCounty) out(`| ${r.county} | ${n(r.n1)} | ${n(r.n2)} | ${n(r.merged_away)} | ${n(r.suffixed)} | ${n(r.quar)} | ${n(r.review)} |`);
  out(`| **Total** | **${n(T.n1)}** | **${n(T.n2)}** | **${n(T.merged_away)}** | **${n(T.suffixed)}** | **${n(T.quar)}** | **${n(T.review)}** |`);

  out();
  out('## 2. Collision outcomes (separator-preserving key)');
  out();
  const col = await q(`
    select county,
      case when note like 'duval_split_merged%' then 'merged: Duval split parcel'
           when note like 'merged_identical_attrs%' then 'merged: identical own_name+jv+dor_uc'
           else 'suffixed -dN, needs_review' end outcome,
      count(*) rows_out,
      sum(cardinality(v1_gids)) v1_rows_in
    from parcels_v2 where note like 'duval_split_merged%' or note like 'merged_identical_attrs%' or note like 'collision_suffixed%'
    group by 1,2 order by 1,2`);
  out('| County | Outcome | v2 rows | v1 rows involved |');
  out('|---|---|---:|---:|');
  for (const r of col) out(`| ${r.county} | ${r.outcome} | ${n(r.rows_out)} | ${n(r.v1_rows_in)} |`);
  const suff = await q(`select parcel_key, parcel_id, match_key, county from parcels_v2 where note like 'collision_suffixed%' order by id limit 6`);
  if (suff.length) { out(); out('Suffixed examples:'); out(); for (const r of suff) out(`- ${r.county}: \`${r.parcel_key}\` (parcel_id \`${r.parcel_id}\`)`); }

  out();
  out('## 3. Quarantined rows (no usable key)');
  out();
  const quar = await q(`select county, count(*) n, count(*) filter (where note like '%empty_geom%') no_geom, string_agg(distinct coalesce(parcel_id,'∅')||'/'||coalesce(parcelno_legacy,'∅'), ' ; ') ids from parcels_v2 where quarantine group by 1 order by 1`);
  out(`Total quarantined: **${n(T.quar)}** (parcel_key NULL, excluded from the unique index).`);
  out();
  out('| County | Rows | of which empty geometry | raw ids (parcel_id/parcelno) |');
  out('|---|---:|---:|---|');
  for (const r of quar) out(`| ${r.county} | ${r.n} | ${r.no_geom} | ${String(r.ids).slice(0, 60)} |`);
  out();
  out('Note: Phase 1 counted 26 rows with no key under the *strict* normalizer. Under the separator-preserving key used for `parcel_key`, 21 are quarantined (Baker 18, Lake 1, Pasco 2) and 5 (Bradford 1, Hamilton 4 — IDs made only of symbols) still get a parcel_key, but their `match_key` is NULL.');
  const mkNull = await q(`select county, count(*) n from parcels_v2 where match_key is null and not quarantine group by 1 order by 1`);
  if (mkNull.length) out('Rows with a parcel_key but no match_key: ' + mkNull.map((r) => `${r.county} ${r.n}`).join(', ') + '.');

  out();
  out('## 4. Geometry');
  out();
  const g = (await q(`select count(*) filter (where note like '%invalid_geom_fixed%') fixed_rows,
      count(*) filter (where note like '%invalid_geom_unfixable%') unfixable,
      count(*) filter (where note like '%empty_geom%') empty_rows,
      count(*) filter (where geom is null) null_geom,
      count(*) filter (where geom is not null and not ST_IsValid(geom)) still_invalid,
      count(*) filter (where geom is not null and GeometryType(geom) <> 'MULTIPOLYGON') non_mp
    from parcels_v2`))[0];
  out(`- ST_MakeValid applied to rows: **${n(g.fixed_rows)}** (v1 had 2,454 invalid parcel geometries; a merged row counts once even if several members were invalid)`);
  out(`- Unfixable (empty after MakeValid): **${n(g.unfixable)}**`);
  out(`- v1 empty/NULL geometry carried as NULL: **${n(g.empty_rows)}** rows flagged \`empty_geom\`; v2 rows with NULL geom in total: ${n(g.null_geom)}`);
  out(`- v2 rows still invalid: **${n(g.still_invalid)}**; non-MultiPolygon: **${n(g.non_mp)}**`);
  const area = await q(`
    with f as (select v.id, v.county, ST_Area(p.geom) a1, ST_Area(v.geom) a2
               from parcels_v2 v join parcels p on p.gid = v.v1_gids[1]
               where cardinality(v.v1_gids)=1 and v.note like '%invalid_geom_fixed%' and v.geom is not null)
    select count(*) n, round(percentile_cont(0.5) within group (order by abs(a2-a1)/nullif(a1,0))::numeric*100, 4) median_pct,
           round(percentile_cont(0.99) within group (order by abs(a2-a1)/nullif(a1,0))::numeric*100, 3) p99_pct,
           round(max(abs(a2-a1)/nullif(a1,0))::numeric*100, 2) max_pct,
           count(*) filter (where abs(a2-a1)/nullif(a1,0) > 0.05) over_5pct from f`);
  if (area[0].n > 0) out(`- Area change on fixed single-row parcels (n=${n(area[0].n)}): median ${area[0].median_pct}%, p99 ${area[0].p99_pct}%, max ${area[0].max_pct}%; ${area[0].over_5pct} changed by more than 5%.`);
  const big = await q(`select v.county, coalesce(v.parcel_id, v.parcelno_legacy) pid,
        round((abs(ST_Area(v.geom)-ST_Area(p.geom))/nullif(ST_Area(p.geom),0))::numeric*100,1) pct
      from parcels_v2 v join parcels p on p.gid=v.v1_gids[1]
      where v.note like '%area_change_gt5pct%' order by 3 desc nulls last`);
  if (big.length) { out(`- Flagged needs_review (area change > 5%, migration 006): ${big.length} parcels. Largest: ` + big.slice(0, 6).map((r) => `${r.county} \`${r.pid}\` ${r.pct}%`).join(', ')); }
  const fixedBy = await q(`select county, count(*) n from parcels_v2 where note like '%invalid_geom_fixed%' group by 1 order by 2 desc limit 6`);
  out('- Most fixes: ' + fixedBy.map((r) => `${r.county} ${r.n}`).join(', '));

  out();
  out('## 5. Leon');
  out();
  const leon = (await q(`select count(*) n, count(*) filter (where note like '%leon_parcelno_repaired%') repaired,
       count(*) filter (where note like '%leon_parcelno_unverified%') unverified,
       count(*) filter (where parcelno_legacy is not distinct from parcel_id) pn_eq_pid,
       count(distinct parcelno_legacy) distinct_pn from parcels_v2 where co_no = 47`))[0];
  const leon1 = (await q(`select count(*) filter (where parcelno is distinct from parcel_id) v1_pn_ne_pid, count(*) n from parcels where county='Leon'`))[0];
  out(`- v1: parcelno ≠ parcel_id on ${n(leon1.v1_pn_ne_pid)} of ${n(leon1.n)} rows.`);
  out(`- v2: \`parcelno_legacy\` repaired from the shapefile on **${n(leon.repaired)}** rows; ${n(leon.unverified)} rows have no shapefile match (parcelno_legacy NULL, needs_review). ${n(leon.pn_eq_pid)} of ${n(leon.n)} now have parcelno_legacy = parcel_id; distinct parcelno_legacy = ${n(leon.distinct_pn)}.`);
  const dupPn = (await q(`select count(*) groups, coalesce(sum(c),0) rows from (select parcelno_legacy, count(*) c from parcels_v2 where co_no=47 and parcelno_legacy is not null group by 1 having count(*)>1) x`))[0];
  out(`- Remaining duplicate parcelno_legacy groups in Leon v2: **${dupPn.groups}** (${dupPn.rows} rows).`);

  out();
  out('## 6. Keys and indexes');
  out();
  const k = (await q(`select count(*) n, count(parcel_key) keyed, count(distinct parcel_key) distinct_keys from parcels_v2`))[0];
  out(`- v2 rows ${n(k.n)}; with parcel_key ${n(k.keyed)}; distinct parcel_key ${n(k.distinct_keys)} ${k.keyed === k.distinct_keys ? '✓ unique' : '✗ DUPLICATES'}`);
  const idx = await q(`select indexname, pg_size_pretty(pg_relation_size(('public.'||indexname)::regclass)) size from pg_indexes where tablename='parcels_v2' order by 1`);
  for (const r of idx) out(`- index \`${r.indexname}\` ${r.size}`);
  const sz = (await q(`select pg_size_pretty(pg_total_relation_size('parcels_v2')) tbl, pg_size_pretty(pg_database_size(current_database())) db`))[0];
  out(`- parcels_v2 total ${sz.tbl}; database now ${sz.db}`);

  const diffFile = process.argv[2];
  if (diffFile && fs.existsSync(diffFile)) {
    const d = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
    out();
    out('## 7. parcels.own_name vs source shapefiles');
    out();
    out('Compared (upper-cased, whitespace-collapsed) `own_name` in v1 to `OWN_NAME` in each county\'s source `.dbf`, matching on parcel id / parcelno. "Differ" = both non-blank and not equal, i.e. candidates for manual edits (or a source that changed between loads).');
    out();
    out('| County | DB rows | matched | same | DB blank, source has | DB has, source blank | **differ** | not found |');
    out('|---|---:|---:|---:|---:|---:|---:|---:|');
    const tot = { db_rows: 0, matched: 0, same: 0, db_blank_src_has: 0, db_has_src_blank: 0, differ: 0, not_found: 0 };
    for (const [county, s] of Object.entries(d)) {
      for (const kk of Object.keys(tot)) tot[kk] += s[kk];
      out(`| ${county} | ${n(s.db_rows)} | ${n(s.matched)} | ${n(s.same)} | ${n(s.db_blank_src_has)} | ${n(s.db_has_src_blank)} | ${n(s.differ)} | ${n(s.not_found)} |`);
    }
    out(`| **Total** | ${n(tot.db_rows)} | ${n(tot.matched)} | ${n(tot.same)} | ${n(tot.db_blank_src_has)} | ${n(tot.db_has_src_blank)} | **${n(tot.differ)}** | ${n(tot.not_found)} |`);
    const leonD = d['Leon'];
    if (leonD) {
      out();
      out(`Leon samples (${leonD.differ} differ):`);
      out();
      out('(Owner names are deliberately omitted from this committed report; parcel ids shown.)');
      out();
      for (const s of leonD.samples) out(`- \`${s.parcel}\``);
    }
  }
  const nalFile = process.argv[4];
  if (nalFile && fs.existsSync(nalFile)) {
    const d2 = JSON.parse(fs.readFileSync(nalFile, 'utf8'));
    out();
    out('### 7b. Rows that differ from the shapefile: do they match the DOR NAL file?');
    out();
    out('Second pass over the counties above whose v1 `own_name` differs from the shapefile. `equals NAL` = v1 matches the NAL CSV (the shapefile is simply a different vintage). **`neither` = v1 matches neither source: the real manual-edit / corruption candidates.**');
    out();
    out('| County | differ from shapefile | equals NAL | **neither** | not in NAL |');
    out('|---|---:|---:|---:|---:|');
    const t2 = { differ_from_dbf: 0, equals_nal: 0, neither: 0, not_in_nal: 0 };
    for (const [county, s] of Object.entries(d2)) {
      for (const kk of Object.keys(t2)) t2[kk] += s[kk];
      out(`| ${county} | ${n(s.differ_from_dbf)} | ${n(s.equals_nal)} | ${n(s.neither)} | ${n(s.not_in_nal)} |`);
    }
    out(`| **Total** | ${n(t2.differ_from_dbf)} | ${n(t2.equals_nal)} | **${n(t2.neither)}** | ${n(t2.not_in_nal)} |`);
    const nei = Object.entries(d2).filter(([, s]) => s.neither > 0);
    if (nei.length) {
      out();
      out('Parcel ids of `neither` rows (first few per county; names omitted): ' +
        nei.map(([c, s]) => c + ': ' + s.samples.map((x) => '`' + x.parcel + '`').join(', ')).join(' | '));
    }
    out();
    out('**Reading this:**');
    out('- ~99% of rows that differ from the shapefile equal the NAL file, so v1 `own_name` was loaded from NAL for those counties and the shapefile is just a different vintage. Leon (2,992 differences) is entirely in this bucket.');
    out('- The `neither` rows (Brevard, Marion) are cases where the shapefile and NAL agree with each other and v1 disagrees with both. Spot checks (locally; names not reproduced here) show a different person, mixed name formats and 30-character truncation, which looks like an older load rather than hand edits.');
    out('- **No proof of manual edits either way.** `phone_number` and `email` are NULL on every row, but `phone_verified`/`email_verified` default to `false`, so rows touched by `PATCH /api/parcels/[id]` cannot be told apart, and the admin UI may save an owner name with blank contact fields. If any admin edits exist they are inside the `neither` set.');
    out('- Volusia has no matching shapefile keys (0 matched), so it could not be compared; its v1 `own_name` is blank for every row.');
  }
  fs.writeFileSync(process.argv[3], L.join('\n') + '\n');
  await c.end(); console.log('wrote', process.argv[3], L.length, 'lines');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
