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
    console.log('🔄 Standardizing Pasco DOR Codes to 3 Digits...');

    // Update query: Pad '01' -> '001', '10' -> '010', '001' stays '001'
    // Logic: LPAD(dor_uc, 3, '0')
    
    // Check how many need update
    const check = await client.query(`
        SELECT count(*) FROM parcels 
        WHERE county = 'Pasco' AND length(dor_uc) < 3
    `);
    console.log(`Found ${check.rows[0].count} records to pad.`);

    if (parseInt(check.rows[0].count) > 0) {
        console.log('Applying padding...');
        const update = await client.query(`
            UPDATE parcels 
            SET dor_uc = LPAD(dor_uc, 3, '0')
            WHERE county = 'Pasco' AND length(dor_uc) < 3 AND dor_uc IS NOT NULL
        `);
        console.log(`Updated ${update.rowCount} records.`);
    } else {
        console.log('No updates needed.');
    }

    // Verify
    const verify = await client.query(`
        SELECT dor_uc, count(*) FROM parcels 
        WHERE county = 'Pasco' 
        GROUP BY dor_uc 
        ORDER BY count DESC 
        LIMIT 5
    `);
    console.table(verify.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
