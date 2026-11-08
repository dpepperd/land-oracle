const shapefile = require('shapefile');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const SHP_PATH = 'D:\\LandOracle\\Florida\\Sumter\\gis\\sumter_2025par.shp';

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️ Loading Sumter Sample (with Reprojection)...');
    
    const source = await shapefile.open(SHP_PATH, undefined, { encoding: 'utf-8' });

    let count = 0;
    let result;
    
    // Clear Sumter first for clean test
    // WARNING: Only clears Sumter
    await client.query("DELETE FROM parcels WHERE county = 'Sumter'");
    
    while (count < 10 && (result = await source.read()) && !result.done) {
        const p = result.value.properties;
        const geojson = result.value.geometry;

        const parcelId = p.PARCELNO;
        const owner = p.OWN_NAME;
        const address = p.PHY_ADDR1;
        const city = p.PHY_CITY;
        const zip = p.PHY_ZIPCD;
        const dor = p.DOR_UC ? p.DOR_UC.toString().padStart(3, '0') : null; // Pad DOR

        const query = `
            INSERT INTO parcels (
                county, parcel_id, parcelno, own_name, phy_addr1, phy_city, dor_uc,
                geom, geojson
            ) VALUES (
                'Sumter', $1, $1, $2, $3, $4, $5,
                ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6), 2882), 4326),
                $6
            )
            RETURNING gid, ST_AsText(geom) as wkt, ST_X(ST_Centroid(geom)) as lon, ST_Y(ST_Centroid(geom)) as lat
        `;

        const res = await client.query(query, [
            parcelId, owner, address, city, dor, 
            JSON.stringify(geojson)
        ]);
        
        const row = res.rows[0];
        console.log(`✅ Loaded ${parcelId}: ${row.lat}, ${row.lon}`);
        
        if (row.lat < 24 || row.lat > 31 || row.lon > -80 || row.lon < -87) {
            console.error('❌ COORDINATE ALARM! Reprojection might be wrong.');
        }

        count++;
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
