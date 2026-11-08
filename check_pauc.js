const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const gid = 12390;
    console.log(`Checking details for GID ${gid} (332S22000000000020)...`);
    
    const res = await client.query(`
      SELECT 
        parcel_id, 
        dor_uc, 
        pa_uc, 
        no_res_unt, 
        tot_lvg_ar,
        imp_qual,
        const_clas
      FROM parcels 
      WHERE gid = $1
    `, [gid]);
    
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
