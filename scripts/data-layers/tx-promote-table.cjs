// Promotes the Texas staging table to public.parcels_tx, adds county display names and the view parcels_tx_current
// (same column names as Florida's / NC's search view). Only ADDS objects (plus a rename of the staging table); other tables are untouched.
// No rows are rewritten: county names come from a small lookup table that the view joins, so the 11 GB table is not duplicated.
// Usage: node scripts/data-layers/tx-promote-table.cjs
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 3600000 });
const log = (...a) => console.log(...a);
(async () => {
  const names = [...fs.readFileSync('lib/txStates.ts', 'utf8').matchAll(/\[(\d+),"([^"]+)"\]/g)].map((m) => [Number(m[1]), m[2]]);
  if (names.length !== 253) throw new Error('expected 253 counties in lib/txStates.ts, got ' + names.length);
  const ex = (await pool.query(`select to_regclass('public.parcels_tx') t, to_regclass('public.tx_parcels_stage') s`)).rows[0];
  if (!ex.t && ex.s) { await pool.query('ALTER TABLE public.tx_parcels_stage RENAME TO parcels_tx'); log('renamed tx_parcels_stage -> parcels_tx'); } else log('table state:', JSON.stringify(ex));

  await pool.query('CREATE TABLE IF NOT EXISTS public.tx_county_names (co_no smallint PRIMARY KEY, name text NOT NULL)');
  await pool.query('TRUNCATE public.tx_county_names');
  for (const [c, n] of names) await pool.query('INSERT INTO public.tx_county_names (co_no, name) VALUES ($1, $2)', [c, n]);
  log('county names:', names.length);

  await pool.query('CREATE INDEX IF NOT EXISTS parcels_tx_own_state ON public.parcels_tx (own_state)');
  await pool.query('CREATE INDEX IF NOT EXISTS parcels_tx_vacant ON public.parcels_tx (co_no) WHERE likely_vacant');
  log('indexes ok');

  await pool.query(`CREATE OR REPLACE VIEW public.parcels_tx_current AS
    SELECT p.gid, 'TX'::char(2) AS state, p.co_no, p.parcel_key, p.parcel_key_local, NULL::text AS match_key, COALESCE(n.name, p.county) AS county, p.parcel_id, NULL::text AS parcelno, p.alt_key,
           p.own_name, p.own_addr1, p.own_addr2, p.own_city, p.own_state, p.own_zipcd, p.phy_addr1, p.phy_addr2, p.phy_city, p.phy_zipcd,
           p.acreage, COALESCE(p.use_desc, p.use_code) AS dor_uc, p.use_code, p.use_desc, p.owner_type,
           p.jv, p.land_value, p.improvement_value, p.year_built, NULL::smallint AS eff_year_built, NULL::bigint AS living_area_sqft, NULL::boolean AS homestead,
           p.sale1_date, NULL::bigint AS sale_prc1, NULL::date AS sale2_date, NULL::bigint AS sale_prc2, NULL::date AS sale3_date, NULL::bigint AS sale_prc3,
           NULL::numeric AS distance_to_highway, p.latitude, p.longitude, p.geom, true AS has_geom, p.likely_vacant, p.source_revised, NULL::text AS acreage_source,
           CASE WHEN p.use_code IS NOT NULL THEN
                  CASE upper(left(p.use_code, 1))
                    WHEN 'A' THEN 'residential' WHEN 'M' THEN 'residential' WHEN 'O' THEN 'residential'
                    WHEN 'B' THEN 'multifamily' WHEN 'C' THEN 'vacant'
                    WHEN 'D' THEN 'agricultural' WHEN 'E' THEN 'agricultural'
                    WHEN 'F' THEN CASE WHEN upper(left(p.use_code, 2)) = 'F2' THEN 'industrial' ELSE 'commercial' END
                    WHEN 'L' THEN 'commercial' WHEN 'J' THEN 'industrial' WHEN 'X' THEN 'exempt'
                    ELSE 'other' END
                WHEN p.likely_vacant THEN 'vacant' END AS lu_cat
      FROM public.parcels_tx p LEFT JOIN public.tx_county_names n ON n.co_no = p.co_no`);
  log('view created');
  const role = (await pool.query(`select 1 from pg_roles where rolname='landoracle_prod'`)).rowCount;
  if (role) { await pool.query('GRANT SELECT ON public.parcels_tx, public.parcels_tx_current, public.tx_county_names TO landoracle_prod'); log('granted read to landoracle_prod'); }
  log('running VACUUM ANALYZE (several minutes)...');
  const t = Date.now();
  await pool.query('VACUUM (ANALYZE) public.parcels_tx');
  log('vacuum analyze done in', Math.round((Date.now() - t) / 1000) + 's');
  const s = (await pool.query(`select pg_size_pretty(pg_total_relation_size('public.parcels_tx')) t, (select count(*) from public.parcels_tx_current) rows, pg_size_pretty(pg_database_size(current_database())) db`)).rows[0];
  log('FINAL', JSON.stringify(s));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
