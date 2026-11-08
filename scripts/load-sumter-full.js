const shapefile = require('shapefile');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const SHP_PATH = 'D:\\LandOracle\\Florida\\Sumter\\gis\\sumter_2025par.shp';
const BATCH_SIZE = 2000;

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Sumter Full Load...');
    console.time('FullLoad');

    // 1. Clean existing Sumter data
    console.log('🧹 Clearing old Sumter data...');
    await client.query("DELETE FROM parcels WHERE county = 'Sumter'");

    const source = await shapefile.open(SHP_PATH, undefined, { encoding: 'utf-8' });
    
    let result;
    let batch = [];
    let count = 0;

    while (true) {
        result = await source.read();
        if (result.done) break;

        const p = result.value.properties;
        const geojson = result.value.geometry;
        
        if (!geojson) continue;

        const record = {
            parcel_id: p.PARCELNO,
            parcelno: p.PARCELNO,
            own_name: p.OWN_NAME,
            phy_addr1: p.PHY_ADDR1,
            phy_city: p.PHY_CITY,
            phy_zipcd: p.PHY_ZIPCD,
            dor_uc: p.DOR_UC ? p.DOR_UC.toString().padStart(3, '0') : null,
            geojson: JSON.stringify(geojson)
        };

        batch.push(record);

        if (batch.length >= BATCH_SIZE) {
            await insertBatch(client, batch);
            count += batch.length;
            process.stdout.write(`\rLoaded ${count} records...`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await insertBatch(client, batch);
        count += batch.length;
    }

    console.log(`\n✅ Finished! Total records: ${count}`);
    console.timeEnd('FullLoad');

  } catch (e) {
    console.error('❌ Fatal Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}

async function insertBatch(client, batch) {
    // Generate $1, $2, ... placeholders
    // Columns: county, parcel_id, parcelno, own_name, phy_addr1, phy_city, dor_uc, geojson, geom
    // 9 columns per row
    
    const values = [];
    const placeholders = [];
    
    batch.forEach((r, i) => {
        const offset = i * 9;
        placeholders.push(`(
            'Sumter', 
            $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 
            $${offset + 5}, $${offset + 6}, $${offset + 8}, 
            ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${offset + 9}), 2882), 4326)
        )`);
        
        // Push params
        values.push(
            r.parcel_id, r.parcelno, r.own_name, r.phy_addr1, 
            r.phy_city, r.dor_uc, r.phy_zipcd, // Wait, order check:
            // county(static), id, no, name, addr, city, dor, geojson, geom(from geojson)
            // My placeholders above use $offset+6 for dor_uc?
            // Let's be precise.
        );
        // RE-DOING PARAMS TO BE SAFE
        /*
            $1: id
            $2: no
            $3: name
            $4: addr
            $5: city
            $6: dor
            $7: zip (Wait, did I include zip in insert?) - Check load-sumter-sample
            sample had: county, parcel_id, parcelno, own_name, phy_addr1, phy_city, dor_uc, geom, geojson
            
            Let's stick to the verified columns from sample:
            county, parcel_id, parcelno, own_name, phy_addr1, phy_city, dor_uc, geom, geojson
            
            Params needed per row provided to query:
            id, no, name, addr, city, dor, geojson
            7 params per row.
        */
    });

    // Let's restructure insertBatch to be simpler/safer
    const query = `
        INSERT INTO parcels (
            county, parcel_id, parcelno, own_name, phy_addr1, phy_city, dor_uc, geojson, geom
        ) VALUES ${batch.map((_, i) => {
            const o = i * 7;
            // $1..$7
            return `('Sumter', $${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${o+7}), 2882), 4326))`
        }).join(', ')}
        ON CONFLICT (parcel_id) DO NOTHING
    `;

    const flatValues = batch.flatMap(r => [
        r.parcel_id, 
        r.parcelno, 
        r.own_name, 
        r.phy_addr1, 
        r.phy_city, 
        r.dor_uc, 
        r.geojson
    ]);

    await client.query(query, flatValues);
}

run();
