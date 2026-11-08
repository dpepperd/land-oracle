const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  const targetParcel = 'R24 122 21 0880 0140 0050';

  try {
    console.log(`🎯 Loading Target Parcel: ${targetParcel}`);
    
    const shpPath = 'D:\\LandOracle\\Florida\\Hernando\\gis\\hernando_2025Ppar.shp';
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
            const altKey = p.ALT_KEY || ''; // 00026171
            
            // Numeric Safeguard
            const jv = Number(p.JV) || 0;
            const sqFt = Number(p.LND_SQFOOT) || 0;
            const acreage = (sqFt / 43560) || 0;
            
            const dor = p.DOR_UC || '000';
            
            const geojson = JSON.stringify(result.value.geometry);
            
            const query = `
                INSERT INTO parcels (
                    county, parcel_id, alt_key, own_name, 
                    phy_addr1, phy_city, phy_zipcd,
                    dor_uc, jv, acreage,
                    own_addr1, own_city, own_state, own_zipcd,
                    geom, geojson
                ) VALUES (
                    'Hernando',
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($14), 2882), 4326),
                    $14
                )
                ON CONFLICT (parcel_id) DO UPDATE SET
                    alt_key = EXCLUDED.alt_key,
                    geom = EXCLUDED.geom;
            `;
            
            const values = [
                parcelId, altKey, p.OWN_NAME, 
                p.PHY_ADDR1, p.PHY_CITY, String(p.PHY_ZIPCD || ''),
                dor, jv, acreage,
                p.OWN_ADDR1, p.OWN_CITY, p.OWN_STATE_, String(p.OWN_ZIPCD || ''),
                geojson
            ];
            
            await client.query(query, values);
            console.log('✅ Inserted into Database!');
            
            break;
        }
        
        if (count % 100000 === 0) console.log(`Scanned ${count} records...`);
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
