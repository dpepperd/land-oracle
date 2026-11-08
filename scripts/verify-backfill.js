const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT count(*) FROM flood_hazard WHERE source_name = 'DUVAL'");
    console.log('Duval/Source Rows:', res.rows[0].count);
    
    const indexRes = await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'flood_hazard' AND indexname = 'flood_hazard_source_idx'");
    console.log('Index Verification:', indexRes.rows.length > 0 ? '✅ Found' : '❌ Missing');
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
verify();
