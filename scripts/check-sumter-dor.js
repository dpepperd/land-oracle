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
    console.log('🔍 Checking Sumter Land Use Codes...');
    
    // Check distribution
    const res = await client.query(`
        SELECT dor_uc, count(*) 
        FROM parcels 
        WHERE county = 'Sumter' 
        GROUP BY dor_uc 
        ORDER BY count(*) DESC
        LIMIT 20
    `);

    console.log('Top 20 DOR Codes in Sumter:');
    console.table(res.rows);

    // Check what Single Family might be
    // Typically 001, 01, 1
    const sf = await client.query(`
        SELECT * FROM parcels 
        WHERE county = 'Sumter' 
        AND (dor_uc = '001' OR dor_uc = '01' OR dor_uc = '1')
        LIMIT 5
    `);
    
    if (sf.rows.length === 0) {
        console.log('⚠️ No standard Single Family (001) found.');
    } else {
        console.log('✅ Found explicit 001 records:', sf.rows.length);
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
