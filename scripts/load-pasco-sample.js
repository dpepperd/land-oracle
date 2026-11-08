const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const Papa = require('papaparse');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const PASCO_PATH = 'D:\\LandOracle\\Florida\\Pasco';

async function run() {
  console.log('📍 Inspecting Pasco Data...');

  // 1. Find Files
  const nalFile = fs.readdirSync(PASCO_PATH).find(f => f.startsWith('NAL') && f.endsWith('.csv'));
  const gisFiles = fs.readdirSync(path.join(PASCO_PATH, 'gis'));
  const shpFile = gisFiles.find(f => f.endsWith('.shp'));

  if (!nalFile || !shpFile) {
      console.error('❌ Missing NAL or SHP file');
      return;
  }

  console.log(`   NAL: ${nalFile}`);
  console.log(`   SHP: ${shpFile}`);

  // 2. Read NAL Sample
  console.log('📄 Reading NAL Headers...');
  const nalPath = path.join(PASCO_PATH, nalFile);
  const nalContent = fs.readFileSync(nalPath, 'utf8');
  
  // Parse first 500 lines only
  const nalResults = Papa.parse(nalContent, {
      header: true,
      preview: 500,
      skipEmptyLines: true
  });
  
  const nalHeaders = nalResults.meta.fields;
  console.log('   Headers found:', nalHeaders.filter(h => h.includes('OWN') || h.includes('PARCEL') || h.includes('JV')).join(', '));
  
  // Create Lookup Map from Sample
  const nalMap = new Map();
  nalResults.data.forEach(row => {
      if (row.PARCEL_ID) nalMap.set(row.PARCEL_ID.trim(), row);
  });
  console.log(`   Loaded ${nalMap.size} NAL records for sample.`);

  // 3. Read Shapefile Sample (Direct Mode)
  console.log('🗺️  Reading Shapefile Sample (Direct from SHP attributes)...');
  const source = await shapefile.open(path.join(PASCO_PATH, 'gis', shpFile));
  
  let count = 0;
  
  while (count < 100) {
      const result = await source.read();
      if (result.done) break;
      count++;

      const f = result.value;
      const props = f.properties;
      const geom = f.geometry;

      // Pasco SHP attributes are rich: PARCELNO, OWN_NAME, PHY_ADDR1, JV, etc.
      // We map them directly without NAL join.
      const id = props.PARCELNO || props.PARCEL_ID;
      
      if (id) {
          // Log first 3 for validation
          if (count <= 3) {
            console.log(`\n✅ FOUND: ${id}`);
            console.log(`   Owner: ${props.OWN_NAME}`);
            console.log(`   Addr:  ${props.PHY_ADDR1}`);
            console.log(`   Value: ${props.JV}`);
          }
          
          await insertSample('Pasco', id, props, geom);
      }
  }
  pool.end();
}

async function insertSample(county, id, props, geom) {
    const client = await pool.connect();
    try {
        const acreage = parseFloat(props.LND_SQFOOT || 0) / 43560;
        
        // Centroid quick calc
        let lat=null, lon=null;
        // ... (existing logic)
        try {
            if (geom.type === 'Polygon' && geom.coordinates[0]) {
                const ring = geom.coordinates[0];
                lat = ring[0][1];
                lon = ring[0][0];
            } else if (geom.type === 'MultiPolygon' && geom.coordinates[0][0]) {
                const ring = geom.coordinates[0][0];
                lat = ring[0][1];
                lon = ring[0][0];
            }
        } catch(e) {}

        const parcelId = `${county}-${id}`;
        
        await client.query(`
            INSERT INTO parcels (
                parcel_id, county, own_name, phy_addr1, 
                jv, acreage, geojson, latitude, longitude,
                own_addr1, own_city, own_state, own_zipcd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (parcel_id) DO UPDATE SET own_name = EXCLUDED.own_name
        `, [
            parcelId, county, 
            props.OWN_NAME, 
            props.PHY_ADDR1,
            parseFloat(props.JV || 0),
            acreage,
            JSON.stringify(geom),
            lat, lon,
            props.OWN_ADDR1,
            props.OWN_CITY,
            props.OWN_STATE,
            props.OWN_ZIPCD
        ]);
        console.log('   ✅ Insert Success');

    } catch (e) {
        console.error('   ❌ Insert Failed:', e.message);
    } finally {
        client.release();
    }
}

run();
