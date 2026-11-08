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
    console.log('🔍 Inspecting DOR Codes for Other Counties...');

    const counties = ['Lee', 'Sarasota', 'Manatee'];
    
    for (const county of counties) {
        const res = await client.query(`
            SELECT dor_uc, count(*) as count 
            FROM parcels 
            WHERE county = $1 
            GROUP BY dor_uc 
            ORDER BY count DESC 
            LIMIT 5
        `, [county]);
        
        console.log(`\n--- ${county} ---`);
        console.table(res.rows);
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
