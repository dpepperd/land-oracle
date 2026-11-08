// scripts/check-all-databases.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkEverything() {
  // Check all tables
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log('\n📊 All tables:');
  for (const row of tables.rows) {
    const count = await pool.query(`SELECT COUNT(*) as count FROM ${row.table_name};`);
    console.log(`  ${row.table_name}: ${count.rows[0].count} rows`);
  }
  
  // Check database size
  const size = await pool.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size;
  `);
  console.log('\n💾 Database size:', size.rows[0].size);
  
  await pool.end();
}

checkEverything();