// Pass 2: owner state + ZIP read from the END of a one-line mailing address ("... MAGGIE VALLEY, NC 28751-9400") when own_state is still missing.
require('dotenv').config({ path: '.env.local', quiet: true });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 1500000 });
const STATES = "AL,AK,AZ,AR,CA,CO,CT,DE,DC,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY,PR,GU,VI,AA,AE,AP".split(',');
const RE = '[ ,]+([A-Z]{2})[ ,]+(\\d{5})(?:-\\d{4})?[ ]*$';
const M = `(regexp_match(own_addr1, '${RE}'))`;
// valid state, address has a comma, and CT (also a street suffix) only when a comma sits right before it
const WHERE = `own_state IS NULL AND own_addr1 IS NOT NULL AND own_addr1 ~ ',' AND ${M}[1] = ANY($1) AND (${M}[1] <> 'CT' OR own_addr1 ~ ',\\s*CT\\s+\\d{5}')`;
(async () => {
  const q = async (l, sql, p) => { const r = await pool.query(sql, p); console.log('-- ' + l + ' ' + JSON.stringify(r.rows)); return r.rows; };
  await q('still missing state', `select count(*) n from parcels_nc where own_state is null`);
  await q('rows pass 2 can fix', `select count(*) n, count(*) filter (where ${M}[1] = 'NC') nc, count(*) filter (where ${M}[1] <> 'NC') other from parcels_nc where ${WHERE}`, [STATES]);
  await q('CT hits (street-suffix risk)', `select count(*) n from parcels_nc where ${WHERE} and ${M}[1] = 'CT'`, [STATES]);
  await q('samples', `select own_addr1, ${M}[1] st, ${M}[2] zip from parcels_nc where ${WHERE} and ${M}[1] <> 'NC' limit 4`, [STATES]);
  const counties = (await pool.query(`select distinct co_no from parcels_nc where own_state is null and own_addr1 ~ ',' order by 1`)).rows;
  let total = 0;
  for (const c of counties) {
    const r = await pool.query(`UPDATE public.parcels_nc SET own_state = ${M}[1], own_zipcd = COALESCE(own_zipcd, ${M}[2]), owner_loc_parsed = true WHERE co_no = $2 AND ${WHERE}`, [STATES, c.co_no]);
    total += r.rowCount;
  }
  console.log('pass 2 parsed rows:', total);
  await q('after', `select count(*) total, count(*) filter (where own_state is null) no_state, round(100.0*count(*) filter (where own_state is null)/count(*),1) pct_no_state, count(*) filter (where own_state is not null and own_state <> 'NC') out_of_state, count(*) filter (where owner_loc_parsed) parsed_total from parcels_nc`);
  const t = Date.now(); await pool.query('VACUUM (ANALYZE) public.parcels_nc'); console.log('vacuum analyze', Math.round((Date.now() - t) / 1000) + 's');
  await pool.end();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
