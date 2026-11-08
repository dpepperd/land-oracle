const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Config
const COUNTY = 'Sarasota';
const NAL_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\NAL68F202501.csv';
const SHP_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\gis\\sarasota_2025par.shp';
const LIMIT = 50;

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function load() {
  console.log(`\n🚀 Starting ${COUNTY} Sample Load (${LIMIT} records)...`);
  
  const client = await pool.connect();
  
  try {
      // Clean up previous test
      await client.query('DELETE FROM parcels WHERE county = $1', [COUNTY]);
      console.log(`🗑️ Cleared existing ${COUNTY} records.`);
      
      // 1. Read CSV
      console.log('📖 Reading CSV...');
      const records = [];
      const stream = fs.createReadStream(NAL_FILE).pipe(csv());
      
       for await (const row of stream) {
            if (records.length >= LIMIT) break;
            
            const pid = row.PARCEL_ID;
            if (pid) {
                records.push({
                    parcel_id: pid,
                    parcelno: pid,
                    owner: row.OWN_NAME,
                    address: `${row.PHY_ADDR1 || ''} ${row.PHY_CITY || ''}`,
                    city: row.PHY_CITY,
                    zip: row.PHY_ZIPCD, // Ensure numeric or string handled
                    total_value: parseInt(row.JV) || 0,
                    acres: parseFloat(row.ACREAGE) || 0,
                    dor_code: row.DOR_UC
                });
            }
       }
       
       console.log(`📋 Found ${records.length} records. Loading...`);
       
       // 2. Insert
       let inserted = 0;
       for (const r of records) {
            // Geometry skipped for now to ensure stability
            // Use simple INSERT
            await client.query(`
                INSERT INTO parcels (
                  parcel_id, parcelno, file_t, county, 
                  own_name, phy_addr1, phy_city, phy_zipcd, 
                  jv, acreage, dor_uc, geom
                ) VALUES (
                  $1, $2, 'R', $3, 
                  $4, $5, $6, $7, 
                  $8, $9, $10, NULL
                )
            `, [
                r.parcel_id, r.parcelno, COUNTY,
                r.owner, r.address, r.city, r.zip,
                r.total_value, r.acres, r.dor_code
            ]);
            process.stdout.write('.');
            inserted++;
       }
       console.log(`\n✅ Successfully loaded ${inserted} records.`);
      
  } catch (e) {
      console.error('\n❌ Load Failed:', e);
  } finally {
      client.release();
      pool.end();
  }
}

load();
