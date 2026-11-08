const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('🧹 Deduplicating parcels table...');
  try {
    // Delete duplicates, keeping the one with the highest GID
    const res = await pool.query(`
      DELETE FROM parcels a USING parcels b
      WHERE a.gid < b.gid 
      AND a.parcel_id = b.parcel_id;
    `);
    console.log(`✅ Deleted ${res.rowCount} duplicate rows.`);
    
    // Now try creating index again
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS parcels_parcel_id_idx ON parcels (parcel_id);
    `);
    console.log('✅ Unique Index Created.');
    
    await pool.query(`
        ALTER TABLE parcels 
        ADD CONSTRAINT parcels_parcel_id_unique UNIQUE USING INDEX parcels_parcel_id_idx;
    `);
    console.log('✅ Constraint Added.');

  } catch(e) { 
      console.error('❌ Failed:', e.message); 
      // If constraint already exists, that's fine
  }
  pool.end();
}
run();
