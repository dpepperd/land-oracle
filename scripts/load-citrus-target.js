const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

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
  const targetParcel = '17E19S36      4D000 0290'; // Exact string from broad search

  try {
    console.log(`🎯 Loading Target Parcel: ${targetParcel.trim()}`);
    
    const shpPath = 'D:\\LandOracle\\Florida\\Citrus\\gis\\citrus_2025Ppar.shp';
    const source = await shapefile.open(shpPath);
    
    let found = false;
    let count = 0;
    while (true) {
        const result = await source.read();
        if (result.done) break;
        count++;
        
        const p = result.value.properties;
        if (p.PARCELNO === targetParcel) {
            found = true;
            console.log('✅ Found in Shapefile!');
            
            // Sanitize
            const parcelId = p.PARCELNO;
            const altKey = p.ALT_KEY || ''; 
            const ownerName = p.OWN_NAME;
            
            const dor = p.DOR_UC || '000';
            const jv = safeNum(p.JV);
            const sqFt = safeNum(p.LND_SQFOOT);
            const acreage = sqFt > 0 ? (sqFt / 43560) : 0;
            
            const geojson = JSON.stringify(result.value.geometry);
            
            // Use safeZip logic directly in values construction
            const phyZip = safeZip(p.PHY_ZIPCD);
            const ownZip = safeZip(p.OWN_ZIPCD);
            
            const query = `
                INSERT INTO parcels (
                    county, parcel_id, alt_key, own_name, 
                    phy_addr1, phy_city, phy_zipcd,
                    dor_uc, jv, acreage,
                    own_addr1, own_city, own_state, own_zipcd,
                    geom, geojson
                ) VALUES (
                    'Citrus',
                    $1, $2, $3, $4, $5, ${phyZip}, $6, $7, $8, $9, $10, $11, ${ownZip},
                    ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($12), 2882), 4326),
                    $12
                )
                ON CONFLICT (parcel_id) DO UPDATE SET
                    alt_key = EXCLUDED.alt_key,
                    geom = EXCLUDED.geom;
            `;
            
            // Note: Zips are embedded in query string above to avoid type issues with params
            const values = [
                parcelId, altKey, ownerName, 
                p.PHY_ADDR1, p.PHY_CITY,
                dor, jv, acreage,
                p.OWN_ADDR1, p.OWN_CITY, p.OWN_STATE,
                geojson
            ];
            
            await client.query(query, values);
            console.log('✅ Inserted into Database!');
            
            break;
        }
        
        if (count % 50000 === 0) console.log(`Scanned ${count} records...`);
    }
    
    if (!found) console.error('❌ Target Parcel NOT FOUND in Shapefile');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
