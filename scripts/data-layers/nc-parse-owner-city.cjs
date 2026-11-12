// Splits "CITY ST 12345-6789" out of own_city into own_city / own_state / own_zipcd for NC rows where the state is missing. Marks rows owner_loc_parsed.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 1500000 });
const STATES = "AL,AK,AZ,AR,CA,CO,CT,DE,DC,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY,PR,GU,VI,AA,AE,AP".split(',');
// city (lazy), then a valid state abbreviation, then an optional ZIP (5 or 5+4) at the end
const RE = '^(.+?)[ ,]+([A-Z]{2})(?:[ ,]+(\\d{5})(?:-\\d{4})?)?[ ]*$';
const SQL_MATCH = `(regexp_match(own_city, '${RE}'))`;
(async () => {
  const q = async (l, sql, p) => { const r = await pool.query(sql, p); console.log('-- ' + l + ' ' + JSON.stringify(r.rows)); return r.rows; };
  await q('before', `select count(*) null_state, count(*) filter (where own_city is not null) with_city from parcels_nc where own_state is null`);
  await q('how many null-state rows match the pattern with a valid state', `select count(*) matched, count(*) filter (where (${SQL_MATCH})[3] is not null) with_zip from parcels_nc where own_state is null and own_city is not null and (${SQL_MATCH})[2] = ANY($1)`, [STATES]);
  await q('examples that do NOT match', `select own_city, count(*) n from parcels_nc where own_state is null and own_city is not null and not ((${SQL_MATCH})[2] = ANY($1) ) group by 1 order by 2 desc limit 8`, [STATES]);
  await pool.query('ALTER TABLE public.parcels_nc ADD COLUMN IF NOT EXISTS owner_loc_parsed boolean NOT NULL DEFAULT false');
  const counties = (await pool.query(`select distinct co_no from parcels_nc where own_state is null and own_city is not null order by 1`)).rows;
  let total = 0;
  for (const c of counties) {
    const r = await pool.query(`UPDATE public.parcels_nc p SET own_city = btrim((regexp_match(p.own_city, '${RE}'))[1], ' ,'), own_state = (regexp_match(p.own_city, '${RE}'))[2],
        own_zipcd = (regexp_match(p.own_city, '${RE}'))[3], owner_loc_parsed = true
      WHERE p.co_no = $1 AND p.own_state IS NULL AND p.own_city IS NOT NULL AND (regexp_match(p.own_city, '${RE}'))[2] = ANY($2)`, [c.co_no, STATES]);
    total += r.rowCount;
  }
  console.log('parsed rows:', total);
  await q('after', `select count(*) null_state, count(*) filter (where owner_loc_parsed) parsed, count(*) filter (where own_state is not null and own_state <> 'NC') out_of_state from parcels_nc`);
  await q('Wake samples', `select own_city, own_state, own_zipcd, owner_loc_parsed from parcels_nc where co_no = 183 and owner_loc_parsed limit 3`);
  await q('Wake out-of-state share', `select round(100.0*count(*) filter (where own_state <> 'NC')/count(*),1) oos_pct from parcels_nc where co_no = 183`);
  const t = Date.now(); await pool.query('VACUUM (ANALYZE) public.parcels_nc'); console.log('vacuum analyze', Math.round((Date.now() - t) / 1000) + 's');
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
