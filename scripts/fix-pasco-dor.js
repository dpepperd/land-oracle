const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const PASCO_PATH = 'D:\\LandOracle\\Florida\\Pasco';

async function run() {
  console.log('🚀 Starting Pasco DOR_UC Backfill...');

  const gisFiles = fs.readdirSync(path.join(PASCO_PATH, 'gis'));
  const shpFile = gisFiles.find(f => f.endsWith('.shp'));
  const shpPath = path.join(PASCO_PATH, 'gis', shpFile);
  
  console.log(`   Source: ${shpPath}`);

  const source = await shapefile.open(shpPath);
  
  const client = await pool.connect();
  
  try {
      let processed = 0;
      let updated = 0;
      let batch = [];
      const BATCH_SIZE = 2000;

      while (true) {
          const result = await source.read();
          if (result.done) {
              if (batch.length > 0) await processBatch(client, batch);
              break;
          }

          const props = result.value.properties;
          const id = props.PARCELNO || props.PARCEL_ID;
          const dor = props.DOR_UC; // e.g., '001', '01', etc.

          if (id && dor) {
              // Normalize to standard 2-digit if it's 3-digit with leading zero?
              // Standard FL DOR codes are usually 2 digits (01, 02). 
              // Pasco sample showed '002', '001'.
              // We will strip leading zeros and pad to 2 chars just in case: '001' -> '01', '075' ->'75'? 
              // Actually '001' is '01' (Single Family). '002' is '02' (Mobile Home).
              // Let's try simple normalization: parseInt().toString().padStart(2, '0')
              // But keep alpha codes intact if any.
              
              let refinedDor = dor;
              if (/^\d+$/.test(dor)) {
                  refinedDor = parseInt(dor, 10).toString().padStart(2, '0');
              }
              
              batch.push({
                  id: `Pasco-${id}`,
                  dor: refinedDor
              });
          }

          processed++;
          if (batch.length >= BATCH_SIZE) {
              await processBatch(client, batch);
              console.log(`   Processed ${processed} records...`);
              batch = [];
              if (global.gc) global.gc();
          }
      }
      
      console.log('✅ Pasco DOR Backfill Complete.');

  } catch (e) {
      console.error('❌ Script Failed:', e);
  } finally {
      client.release();
      pool.end();
  }
}

async function processBatch(client, batch) {
    if (batch.length === 0) return;

    // Create a temporary values list for the update
    // We use a VALUES clause with UPDATE FROM
    
    // (parcel_id, dor_uc)
    const values = batch.map((b, i) => `($${i*2+1}, $${i*2+2})`).join(', ');
    const params = batch.flatMap(b => [b.id, b.dor]);

    const query = `
        UPDATE parcels as p
        SET dor_uc = v.dor_uc
        FROM (VALUES ${values}) as v(parcel_id, dor_uc)
        WHERE p.parcel_id = v.parcel_id  
          AND p.county = 'Pasco'
          AND (p.dor_uc IS NULL OR p.dor_uc != v.dor_uc)
    `;

    await client.query(query, params);
}

run();
