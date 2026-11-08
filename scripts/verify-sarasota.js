
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT parcelno, own_name, jv, ST_AsText(geom) as geom_wkt 
      FROM parcels 
      WHERE county = 'Sarasota' 
      LIMIT 5
    `);
    
    if (res.rows.length === 0) {
        console.log('⚠️ No records found for Sarasota.');
    } else {
        console.table(res.rows.map(r => ({
          ...r,
          geom_wkt: r.geom_wkt ? r.geom_wkt.substring(0, 30) + '...' : 'NULL'
        })));
    }
    
    const countRes = await client.query(`SELECT COUNT(*) FROM parcels WHERE county = 'Sarasota'`);
    console.log(`\n✅ Total Sarasota Records Verified: ${countRes.rows[0].count}`);
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

verify();
