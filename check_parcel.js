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
    const id = '33-2S-22-0000-0000-0020';
    console.log(`Searching for: ${id} ...`);
    
    // Check STRIPPED match (remove dashes)
    const strippedId = id.replace(/-/g, '');
    console.log(`Checking stripped ID: ${strippedId}`);
    
    const res3 = await client.query(`
        SELECT 
            gid, 
            parcel_id, 
            dor_uc as land_use_code, 
            acreage, 
            distance_to_highway,
            own_state,
            (geom IS NOT NULL) as has_geom
        FROM parcels 
        WHERE parcel_id = $1
    `, [strippedId]);
    
    if (res3.rows.length > 0) {
        console.log('✅ Found match!');
        console.table(res3.rows);
        return;
    }

    // Check LIKE match
    console.log('No exact match. Trying PARTIAL match...');
    const res2 = await client.query("SELECT * FROM parcels WHERE parcel_id LIKE $1 OR parcelno LIKE $1 LIMIT 5", [`%${id}%`]);
    
    if (res2.rows.length === 0) {
      console.log('❌ Parcel NOT FOUND (neither exact nor partial).');
    } else {
      console.log('✅ Found PARTIAL matches:', res2.rows.length);
       console.table(res2.rows.map(r => ({ 
            id: r.gid, 
            parcel_id: r.parcel_id, 
            owner: r.owner_name,
            state: r.own_state,
            use_code: r.dor_uc
        })));
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
