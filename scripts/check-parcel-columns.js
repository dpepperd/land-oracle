// scripts/check-parcel-columns.js
   require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
   const { Pool } = require('pg');
   
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: { rejectUnauthorized: false }
   });
   
   async function checkColumns() {
     const result = await pool.query(`
       SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'parcels'
       ORDER BY ordinal_position;
     `);
     
     console.log('\n📋 Parcels table columns:');
     console.table(result.rows);
     
     await pool.end();
   }
   
   checkColumns();