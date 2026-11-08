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
        console.log('🔧 Fixing Constraints on `parcels` table...');
        
        // 1. Drop old constraint
        console.log('   Dropping `parcels_parcel_id_unique`...');
        await client.query('ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_parcel_id_unique');
        console.log('   ✅ Dropped.');

        // 2. Add new composite constraint (County + ID)
        console.log('   Adding UNIQUE (county, parcel_id)...');
        await client.query('ALTER TABLE parcels ADD CONSTRAINT parcels_county_id_unique UNIQUE (county, parcel_id)');
        console.log('   ✅ Added.');

        console.log('\n🎉 Schema Fix Complete! Collisions are now allowed between counties.');

    } catch (e) {
        console.error('❌ Migration Failed:', e.message);
    } finally {
        client.release();
        pool.end();
    }
}

run();
