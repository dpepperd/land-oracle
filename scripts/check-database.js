// scripts/check-database.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  // List all tables
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log('\n📋 Tables in database:');
  console.table(tables.rows);
  
  // Check row counts for each table
  for (const row of tables.rows) {
    const tableName = row.table_name;
    const count = await pool.query(`SELECT COUNT(*) as count FROM ${tableName};`);
    console.log(`${tableName}: ${count.rows[0].count} rows`);
  }
  
  await pool.end();
}

checkDatabase();