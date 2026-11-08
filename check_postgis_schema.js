const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectSchema() {
  try {
    const client = await pool.connect();
    console.log("Connected to New Database!");
    
    // Get all column names from parcels table
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parcels' 
      ORDER BY column_name;
    `);
    
    console.log(`\nFound ${res.rows.length} columns in 'parcels':`);
    res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    
    // Check for land_use specifically
    const landUse = res.rows.find(r => r.column_name.includes('land') || r.column_name.includes('use') || r.column_name.includes('dor'));
    console.log("\nPotential Land Use columns:", landUse);

    client.release();
  } catch (err) {
    console.error("Connection Failed:", err);
  } finally {
    pool.end();
  }
}

inspectSchema();
