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
    console.log('🏁 Final Sumter County Verification 🏁');
    
    // 1. Total Count
    const total = await client.query("SELECT count(*) FROM parcels WHERE county = 'Sumter'");
    console.log(`\n📊 Total Parcels Loaded: ${Number(total.rows[0].count).toLocaleString()}`);
    
    // 2. Geometry Status
    const validGeom = await client.query("SELECT count(*) FROM parcels WHERE county = 'Sumter' AND geom IS NOT NULL AND ST_IsValid(geom)");
    console.log(`🗺️  Valid Geometries:    ${Number(validGeom.rows[0].count).toLocaleString()} (100% Coverage Target)`);

    // 3. Land Use Breakdown
    console.log('\n🏘️  Land Use Breakdown:');
    const breakdown = await client.query(`
        SELECT dor_uc, count(*) as c 
        FROM parcels 
        WHERE county = 'Sumter' 
        GROUP BY dor_uc 
        ORDER BY c DESC 
        LIMIT 5
    `);
    const mapping = {
        '000': 'Vacant Residential',
        '001': 'Single Family',
        '002': 'Mobile Homes',
        '099': 'Non-Ag Acreage',
        '075': 'Religious/Non-Profit' // Guessing common codes, but 001/000/002 are key
    };
    
    breakdown.rows.forEach(r => {
        const label = mapping[r.dor_uc] || 'Other';
        console.log(`   - Code ${r.dor_uc} (${label}): ${Number(r.c).toLocaleString()}`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
