// Cleans duplicate parcel_keys in the NC STAGING table (not live). One transaction: delete exact copies, suffix legitimate extra records.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 1500000 });
const log = (...a) => console.log(...a);
(async () => {
  const c = await pool.connect();
  try {
    const before = (await c.query('select count(*) rows, count(distinct parcel_key) keys from nc_parcels_stage')).rows[0];
    log('BEFORE', JSON.stringify(before));
    await c.query('BEGIN');
    await c.query(`create temp table dupkeys on commit drop as select parcel_key from nc_parcels_stage group by 1 having count(*) > 1`);
    // A. exact copies: same key + same geometry + same attributes -> keep the lowest gid
    const a = await c.query(`
      with ranked as (
        select gid, row_number() over (partition by parcel_key, md5(ST_AsEWKB(geom)), coalesce(own_name,''), coalesce(own_addr1,''), coalesce(jv,-1), coalesce(acreage,-1), coalesce(use_code,''),
                                                    coalesce(land_value,-1), coalesce(improvement_value,-1), coalesce(sale1_date,'1900-01-01'::date) order by gid) rn
          from nc_parcels_stage where parcel_key in (select parcel_key from dupkeys))
      delete from nc_parcels_stage s using ranked r where s.gid = r.gid and r.rn > 1`);
    log('A. exact copies deleted:', a.rowCount);
    // B. remaining records that share a key: stable suffix by (owner, use code, value, gid); the first keeps the plain key
    const b = await c.query(`
      with ranked as (
        select gid, row_number() over (partition by parcel_key order by coalesce(own_name,''), coalesce(use_code,''), coalesce(jv,0) desc, gid) rn
          from nc_parcels_stage where parcel_key in (select parcel_key from dupkeys))
      update nc_parcels_stage s set parcel_key = s.parcel_key || '-D' || r.rn, parcel_key_local = s.parcel_key_local || '-D' || r.rn
        from ranked r where s.gid = r.gid and r.rn > 1`);
    log('B. extra records given a unique suffix:', b.rowCount);
    const mid = (await c.query('select count(*) rows, count(distinct parcel_key) keys from nc_parcels_stage')).rows[0];
    log('AFTER (inside transaction)', JSON.stringify(mid));
    if (mid.rows !== mid.keys) throw new Error('keys still not unique: rows ' + mid.rows + ' keys ' + mid.keys);
    await c.query('COMMIT');
    log('COMMITTED');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); log('ROLLED BACK:', e.message); process.exitCode = 1; }
  finally { c.release(); }
  const after = (await pool.query('select count(*) rows, count(distinct parcel_key) keys, count(*) filter (where parcel_key ~ \'-D[0-9]+$\') suffixed from nc_parcels_stage')).rows[0];
  log('FINAL', JSON.stringify(after));
  await pool.end();
})();
