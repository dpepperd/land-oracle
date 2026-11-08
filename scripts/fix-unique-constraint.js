const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('🔧 Adding UNIQUE constraint to parcel_id...');
  try {
    // We use CREATE UNIQUE INDEX ... which usually helps supports ON CONFLICT
    // Or ALTER TABLE ADD CONSTRAINT
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS parcels_parcel_id_idx ON parcels (parcel_id);
    `);
    console.log('✅ Unique Index Created.');
    
    // Also try adding constraint explicitly to be sure
    try {
        await pool.query(`
            ALTER TABLE parcels 
            ADD CONSTRAINT parcels_parcel_id_unique UNIQUE USING INDEX parcels_parcel_id_idx;
        `);
        console.log('✅ Constraint Added.');
    } catch(e) {
        console.log('ℹ️  Constraint might already exist or duplicates present:', e.message);
    }

  } catch(e) { console.error('❌ Failed:', e); }
  pool.end();
}
run();
