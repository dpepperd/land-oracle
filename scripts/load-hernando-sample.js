const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 50;
const LIMIT = 5000; // Small entry test

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Loading Hernando Sample Data...');
    
    // Reproject logic handled by PostGIS ST_Transform
    const shpPath = 'D:\\LandOracle\\Florida\\Hernando\\gis\\hernando_2025Ppar.shp';
    const source = await shapefile.open(shpPath);
    
    let count = 0;
    let batch = [];
    
    while (true) {
      const result = await source.read();
      if (result.done || count >= LIMIT) break;
      
      const p = result.value.properties;
      const geo = result.value.geometry;
      
      if (!geo) continue;

      // Extract Fields
      const parcelId = p.PARCELNO;
      const altKey = p.ALT_KEY; // For deep linking
      const ownerName = p.OWN_NAME;
      const phyAddr1 = p.PHY_ADDR1;
      const phyCity = p.PHY_CITY;
      const phyZip = p.PHY_ZIPCD;
      const dor = p.DOR_UC || '000'; // Already padded
      const jv = p.JV || 0;
      
      // Calculate Acreage
      const sqFt = p.LND_SQFOOT || 0;
      const acreage = sqFt > 0 ? (sqFt / 43560) : 0;

      // Owner Address
      const ownAddr1 = p.OWN_ADDR1;
      const ownCity = p.OWN_CITY;
      const ownState = p.OWN_STATE_; // "AZ"
      const ownZip = p.OWN_ZIPCD;

      batch.push({
        parcelId, altKey, ownerName, phyAddr1, phyCity, phyZip,
        dor, jv, acreage, ownAddr1, ownCity, ownState, ownZip,
        geojson: JSON.stringify(geo) // Raw GeoJSON (Projected)
      });
      
      count++;
      
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        batch = [];
        console.log(`Loaded ${count} records...`);
      }
    }
    
    if (batch.length > 0) await insertBatch(client, batch);
    
    console.log('✅ Hernando Sample Load Complete.');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

async function insertBatch(client, batch) {
    try {
        const values = batch.map(r => {
            return `(
                'Hernando', 
                '${r.parcelId.replace(/'/g, "''")}', 
                '${(r.altKey || '').replace(/'/g, "''")}',
                '${(r.ownerName || '').replace(/'/g, "''")}', 
                '${(r.phyAddr1 || '').replace(/'/g, "''")}', 
                '${(r.phyCity || '').replace(/'/g, "''")}',
                '${String(r.phyZip || '').replace(/'/g, "''")}',
                '${r.dor}', 
                ${r.jv}, 
                ${r.acreage}, 
                '${(r.ownAddr1 || '').replace(/'/g, "''")}',
                '${(r.ownCity || '').replace(/'/g, "''")}',
                '${(r.ownState || '').replace(/'/g, "''")}',
                '${String(r.ownZip || '').replace(/'/g, "''")}',
                ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('${r.geojson}'), 2882), 4326),
                '${r.geojson}'
            )`;
        });

        const query = `
            INSERT INTO parcels (
                county, parcel_id, alt_key, own_name, phy_addr1, phy_city, phy_zipcd,
                dor_uc, jv, acreage, own_addr1, own_city, own_state, own_zipcd,
                geom, geojson
            ) VALUES ${values.join(', ')}
            ON CONFLICT (parcel_id) DO UPDATE SET
                alt_key = EXCLUDED.alt_key,
                geom = EXCLUDED.geom,
                acreage = EXCLUDED.acreage,
                phy_addr1 = EXCLUDED.phy_addr1
        `;
        
        await client.query(query);
    } catch (err) {
        console.error('❌ Batch Insert Failed!');
        console.error(err.message);
        throw err;
    }
}

run();
