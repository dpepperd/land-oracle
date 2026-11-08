const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 1;
const LIMIT = 5000; 

// Helper
const safeNum = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const safeZip = (v) => {
    if (!v) return 'NULL';
    const n = Number(v);
    return isNaN(n) ? 'NULL' : n;
};

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Loading Citrus Sample Data...');
    
    // Citrus: EPSG:2882 -> 4326
    const shpPath = 'D:\\LandOracle\\Florida\\Citrus\\gis\\citrus_2025Ppar.shp';
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
      const altKey = p.ALT_KEY; 
      const ownerName = p.OWN_NAME;
      const phyAddr1 = p.PHY_ADDR1;
      const phyCity = p.PHY_CITY;
      const phyZip = String(p.PHY_ZIPCD || '');
      const dor = p.DOR_UC || '000';
      const jv = safeNum(p.JV);
      
      // Calculate Acreage
      const sqFt = safeNum(p.LND_SQFOOT);
      const acreage = sqFt > 0 ? (sqFt / 43560) : 0;

      // Owner Address
      const ownAddr1 = p.OWN_ADDR1;
      const ownCity = p.OWN_CITY;
      const ownState = p.OWN_STATE || p.OWN_STATE_; 
      const ownZip = String(p.OWN_ZIPCD || '');

      batch.push({
        parcelId, altKey, ownerName, phyAddr1, phyCity, phyZip,
        dor, jv, acreage, ownAddr1, ownCity, ownState, ownZip,
        geojson: JSON.stringify(geo)
      });
      
      count++;
      
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        batch = [];
        console.log(`Loaded ${count} records...`);
      }
    }
    
    if (batch.length > 0) await insertBatch(client, batch);
    
    console.log('✅ Citrus Sample Load Complete.');

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
                'Citrus', 
                '${r.parcelId.replace(/'/g, "''")}', 
                '${(r.altKey || '').replace(/'/g, "''")}',
                '${(r.ownerName || '').replace(/'/g, "''")}', 
                '${(r.phyAddr1 || '').replace(/'/g, "''")}', 
                '${(r.phyCity || '').replace(/'/g, "''")}',
                ${safeZip(r.phyZip)},
                '${r.dor}', 
                ${r.jv}, 
                ${r.acreage}, 
                '${(r.ownAddr1 || '').replace(/'/g, "''")}',
                '${(r.ownCity || '').replace(/'/g, "''")}',
                '${(r.ownState || '').replace(/'/g, "''")}',
                ${safeZip(r.ownZip)},
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
                phy_addr1 = EXCLUDED.phy_addr1,
                dor_uc = EXCLUDED.dor_uc,
                jv = EXCLUDED.jv
        `;
        
        await client.query(query);
    } catch (err) {
        console.error('❌ Batch Insert Failed!');
        console.error(err.message);
        if (batch.length === 1) console.log('Record:', JSON.stringify(batch[0], null, 2));
        throw err;
    }
}

run();
