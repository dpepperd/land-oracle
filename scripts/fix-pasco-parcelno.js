const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check Stats
    const resBefore = await client.query("SELECT count(*) FROM parcels WHERE county = 'Pasco' AND parcelno IS NULL");
    console.log(`Missing parcelno count: ${resBefore.rows[0].count}`);

    if (parseInt(resBefore.rows[0].count) > 0) {
        console.log('🔄 Backfilling parcelno...');
        // Update: strip 'Pasco-' from parcel_id
        await client.query(`
            UPDATE parcels 
            SET parcelno = SUBSTRING(parcel_id FROM 7) 
            WHERE county = 'Pasco' AND parcelno IS NULL AND parcel_id LIKE 'Pasco-%'
        `);
        console.log('✅ Backfill complete.');
    } else {
        console.log('✅ No backfill needed.');
    }

    // 2. Final Verify
    const resFinal = await client.query("SELECT count(*) as total, count(parcelno) as with_no FROM parcels WHERE county = 'Pasco'");
    console.log('Final Status:', resFinal.rows[0]);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
