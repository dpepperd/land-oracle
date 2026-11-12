// Fills missing NC acreage from the parcel outline (geodesic area / 4046.8564 sq m per acre) and labels it acreage_source='shape'.
// Rows where the state supplied acreage keep it (acreage_source stays NULL = state). NC pilot table only.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 1500000 });
(async () => {
  await pool.query('ALTER TABLE public.parcels_nc ADD COLUMN IF NOT EXISTS acreage_source text');
  const todo = (await pool.query(`select co_no, county, count(*) n from public.parcels_nc where acreage is null group by 1,2 order by 1`)).rows;
  console.log('counties with missing acreage:', todo.length, '| rows:', todo.reduce((a, b) => a + Number(b.n), 0));
  let done = 0;
  for (const c of todo) {
    const t = Date.now();
    const r = await pool.query(`UPDATE public.parcels_nc SET acreage = ROUND((ST_Area(geom::geography) / 4046.8564224)::numeric, 4), acreage_source = 'shape' WHERE co_no = $1 AND acreage IS NULL`, [c.co_no]);
    done += r.rowCount;
    console.log(`${c.county}: ${r.rowCount} filled in ${Math.round((Date.now() - t) / 1000)}s`);
  }
  await pool.query(`CREATE OR REPLACE VIEW public.parcels_nc_current AS
    SELECT gid, 'NC'::char(2) AS state, co_no, parcel_key, parcel_key_local, NULL::text AS match_key, county, parcel_id, NULL::text AS parcelno, alt_key,
           own_name, own_addr1, own_addr2, own_city, own_state, own_zipcd, phy_addr1, phy_addr2, phy_city, phy_zipcd,
           acreage, COALESCE(use_desc, use_code) AS dor_uc, use_code, use_desc, owner_type,
           jv, land_value, improvement_value, year_built, NULL::smallint AS eff_year_built, NULL::bigint AS living_area_sqft, NULL::boolean AS homestead,
           sale1_date, NULL::bigint AS sale_prc1, NULL::date AS sale2_date, NULL::bigint AS sale_prc2, NULL::date AS sale3_date, NULL::bigint AS sale_prc3,
           NULL::numeric AS distance_to_highway, latitude, longitude, geom, true AS has_geom, likely_vacant, source_revised, acreage_source
      FROM public.parcels_nc`);
  console.log('view updated; total filled', done);
  const t = Date.now(); await pool.query('VACUUM (ANALYZE) public.parcels_nc'); console.log('vacuum analyze', Math.round((Date.now() - t) / 1000) + 's');
  const s = (await pool.query(`select count(*) n, count(acreage) acres, count(*) filter (where acreage_source='shape') from_shape, pg_size_pretty(pg_total_relation_size('public.parcels_nc')) sz from public.parcels_nc`)).rows[0];
  console.log('FINAL', JSON.stringify(s));
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
