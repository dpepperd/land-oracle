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
  console.log('🚀 Starting Full Pasco Load (SHP-Only Mode)...');

  // 1. Find SHP
  const gisFiles = fs.readdirSync(path.join(PASCO_PATH, 'gis'));
  const shpFile = gisFiles.find(f => f.endsWith('.shp'));
  if (!shpFile) { console.error('No SHP found'); return; }

  const shpPath = path.join(PASCO_PATH, 'gis', shpFile);
  console.log(`   SHP: ${shpPath}`);

  // 2. Stream & Batch Insert
  const source = await shapefile.open(shpPath);
  
  let chunk = [];
  let totalProcessed = 0;
  // fast-forward
  const SKIP = parseInt(process.env.SKIP || '0');
  console.log(`   ⏭️  Skipping first ${SKIP} records...`);

  const BATCH_SIZE = 2000;

  while (true) {
      const result = await source.read();
      if (result.done) {
          if (chunk.length > 0) await insertBatch(chunk);
          break;
      }
      
      totalProcessed++;
      if (totalProcessed <= SKIP) continue;

      chunk.push(result.value);
      if (chunk.length >= BATCH_SIZE) {
          await insertBatch(chunk);
          console.log(`   Synced ${totalProcessed} parcels...`);
          chunk = [];
          if (global.gc) global.gc();
      }
  }

  console.log('✅ Pasco Load Complete.');
  pool.end();
}

async function insertBatch(features) {
    const client = await pool.connect();
    try {
        const values = [];
        const params = [];
        let paramIdx = 1;

        for (const f of features) {
            const props = f.properties;
            const geom = f.geometry;
            const id = props.PARCELNO || props.PARCEL_ID;
            
            if (!id) continue;

            const parcelId = `Pasco-${id}`;
            const acreage = parseFloat(props.LND_SQFOOT || 0) / 43560;
            
            // Centroid
            let lat=null, lon=null;
            try {
                if (geom.type === 'Polygon' && geom.coordinates[0]) {
                    lat = geom.coordinates[0][0][1];
                    lon = geom.coordinates[0][0][0];
                } else if (geom.type==='MultiPolygon') {
                    lat = geom.coordinates[0][0][0][1];
                    lon = geom.coordinates[0][0][0][0];
                }
            } catch(e) {}

            params.push(
                parcelId, 'Pasco',
                props.OWN_NAME, props.PHY_ADDR1,
                parseFloat(props.JV || 0),
                acreage,
                JSON.stringify(geom),
                lat, lon,
                props.OWN_ADDR1, props.OWN_CITY, props.OWN_STATE, props.OWN_ZIPCD
            );

            // 13 params per row
            values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, $${paramIdx+12})`);
            paramIdx += 13;
        }

        if (values.length === 0) return;

        const query = `
            INSERT INTO parcels (
                parcel_id, county, own_name, phy_addr1, 
                jv, acreage, geojson, latitude, longitude,
                own_addr1, own_city, own_state, own_zipcd
            ) VALUES ${values.join(', ')}
            ON CONFLICT (parcel_id) DO NOTHING
        `;
        
        await client.query(query, params);

    } catch (e) {
        console.error('   ❌ Batch Failed:', e.message);
    } finally {
        client.release();
    }
}

run();
