// Promotes the NC staging table to public.parcels_nc and adds the view parcels_nc_current (same column names as Florida's search view).
// Only ADDS objects (plus a rename of the NC staging table); Florida tables/views are not touched.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 1500000 });
const log = (...a) => console.log(...a);
(async () => {
  const exists = (await pool.query(`select to_regclass('public.parcels_nc') t, to_regclass('public.nc_parcels_stage') s`)).rows[0];
  if (!exists.t && exists.s) { await pool.query('ALTER TABLE public.nc_parcels_stage RENAME TO parcels_nc'); log('renamed nc_parcels_stage -> parcels_nc'); }
  else log('table state:', JSON.stringify(exists));
  await pool.query('CREATE INDEX IF NOT EXISTS parcels_nc_own_state ON public.parcels_nc (own_state)');
  await pool.query('CREATE INDEX IF NOT EXISTS parcels_nc_vacant ON public.parcels_nc (co_no) WHERE likely_vacant');
  log('indexes ok');
  await pool.query(`CREATE OR REPLACE VIEW public.parcels_nc_current AS
    SELECT gid, 'NC'::char(2) AS state, co_no, parcel_key, parcel_key_local, NULL::text AS match_key, county, parcel_id, NULL::text AS parcelno, alt_key,
           own_name, own_addr1, own_addr2, own_city, own_state, own_zipcd, phy_addr1, phy_addr2, phy_city, phy_zipcd,
           acreage, COALESCE(use_desc, use_code) AS dor_uc, use_code, use_desc, owner_type,
           jv, land_value, improvement_value, year_built, NULL::smallint AS eff_year_built, NULL::bigint AS living_area_sqft, NULL::boolean AS homestead,
           sale1_date, NULL::bigint AS sale_prc1, NULL::date AS sale2_date, NULL::bigint AS sale_prc2, NULL::date AS sale3_date, NULL::bigint AS sale_prc3,
           NULL::numeric AS distance_to_highway, latitude, longitude, geom, true AS has_geom, likely_vacant, source_revised
      FROM public.parcels_nc`);
  log('view created');
  const role = (await pool.query(`select 1 from pg_roles where rolname='landoracle_prod'`)).rowCount;
  if (role) { await pool.query('GRANT SELECT ON public.parcels_nc, public.parcels_nc_current TO landoracle_prod'); log('granted read to landoracle_prod'); }
  log('running VACUUM ANALYZE (a few minutes)...');
  const t = Date.now();
  await pool.query('VACUUM (ANALYZE) public.parcels_nc');
  log('vacuum analyze done in', Math.round((Date.now() - t) / 1000) + 's');
  const s = (await pool.query(`select pg_size_pretty(pg_total_relation_size('public.parcels_nc')) t, (select count(*) from public.parcels_nc_current) rows, pg_size_pretty(pg_database_size(current_database())) db`)).rows[0];
  log('FINAL', JSON.stringify(s));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
