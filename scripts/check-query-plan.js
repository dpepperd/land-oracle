const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/check-query-plan.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    // A typical query: Filter by County + Market Value (which uses the slow cast)
    const sql = `
      EXPLAIN ANALYZE SELECT p.gid, p.parcelno, p.jv 
      FROM parcels p
      WHERE p.county = 'Lee'
      AND CAST(NULLIF(REGEXP_REPLACE(COALESCE(CAST(p.jv AS TEXT), '0'), '[^0-9.]', '', 'g'), '') AS NUMERIC) > 100000
      LIMIT 100
    `;
    
    console.log('Running EXPLAIN ANALYZE...');
    const res = await client.query(sql);
    res.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
