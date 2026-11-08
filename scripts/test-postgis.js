require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', '').replace('&sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to database');
    
    try {
      const res = await client.query('SELECT PostGIS_Full_Version()');
      console.log('✅ PostGIS is already installed:', res.rows[0]);
    } catch (e) {
      console.log('⚠️ PostGIS not detected via SELECT. Attempting CREATE EXTENSION...');
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
        console.log('✅ PostGIS extension created successfully.');
      } catch (e2) {
        console.error('❌ Failed to create PostGIS extension:', e2.message, e2.code);
      }
    }

  } catch (err) {
    console.error('❌ Connection error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
