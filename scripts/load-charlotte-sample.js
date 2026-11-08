const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const turf = require('turf');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/load-charlotte-sample.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PROJECTIONS = {
    'Florida_North': '+proj=lcc +lat_1=29.58333333333333 +lat_2=30.75 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', 
    'Florida_East': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', 
    'Florida_West': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs' 
};
let currentProj = PROJECTIONS['Florida_East'];

function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;
  try {
    const transform = (coord) => proj4(currentProj, 'EPSG:4326', coord);
    if (geom.type === 'Polygon') {
      return { type: 'Polygon', coordinates: geom.coordinates.map(ring => ring.map(transform)) };
    } else if (geom.type === 'MultiPolygon') {
      return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(transform))) };
    }
  } catch (err) { return null; }
  return geom;
}

function getGeoStats(geom) {
  if (!geom) return { lat: null, lon: null, acres: null };
  try {
    const feature = { type: 'Feature', geometry: geom, properties: {} };
    const center = turf.centroid(feature);
    const areaSqMeters = turf.area(feature);
    return { 
        lat: center.geometry.coordinates[1], 
        lon: center.geometry.coordinates[0], 
        acres: areaSqMeters * 0.000247105 
    };
  } catch (err) { return { lat: null, lon: null, acres: null }; }
}

async function loadSample() {
  const countyName = 'Charlotte';
  console.log(`\n🚀 Starting SAMPLE Data Load for: ${countyName}`);
  const BASE_DIR = 'D:/LandOracle/Florida/Charlotte';
  
  if (!fs.existsSync(BASE_DIR)) { console.error('County dir not found'); return; }
  const files = fs.readdirSync(BASE_DIR);
  // NAL08...
  const csvFile = files.find(f => f.startsWith('NAL') && f.endsWith('.csv'));
  const nalPath = path.join(BASE_DIR, csvFile);
  
  const gisDir = path.join(BASE_DIR, 'gis');
  const gFiles = fs.readdirSync(gisDir);
  const shpFile = gFiles.find(f => f.endsWith('.shp'));
  const shpPath = path.join(gisDir, shpFile);
  
  // Projection Detection
  const prjPath = shpPath.replace('.shp', '.prj');
  if (fs.existsSync(prjPath)) {
       const prjContent = fs.readFileSync(prjPath, 'utf8');
       if (prjContent.includes('Florida_East')) currentProj = PROJECTIONS['Florida_East'];
       else if (prjContent.includes('Florida_West')) currentProj = PROJECTIONS['Florida_West'];
       else currentProj = PROJECTIONS['Florida_North'];
       console.log(`🌎 Projection: ${currentProj === PROJECTIONS['Florida_East'] ? 'East' : currentProj === PROJECTIONS['Florida_West'] ? 'West' : 'North'}`);
  }

  // 1. Load NAL into Map
  console.log(`\n📖 Reading Tax Roll (NAL)...`);
  const nalMap = new Map();
  let nalCount = 0;
  
  await new Promise((resolve, reject) => {
      fs.createReadStream(nalPath)
        .pipe(csv())
        .on('data', (row) => {
             const id = row.PARCEL_ID;
             if (id) {
                nalMap.set(id, {
                    OWN_NAME: row.OWN_NAME,
                    OWN_ADDR1: row.OWN_ADDR1,
                    OWN_CITY: row.OWN_CITY,
                    OWN_STATE: row.OWN_STATE, 
                    OWN_ZIP: row.OWN_ZIP,
                    DOR_UC: row.DOR_UC,
                    JV: row.JV,
                    AV_SD: row.AV_SD,
                    ALT_KEY: row.ALT_KEY,
                    PHY_ADDR1: row.PHY_ADDR1,
                    PHY_CITY: row.PHY_CITY,
                    PHY_ZIP: row.PHY_ZIPCD
                });
                nalCount++;
            }
        })
        .on('end', () => {
             console.log(`   ✅ Loaded ${nalCount.toLocaleString()} NAL records.`);
             resolve();
        })
        .on('error', reject);
  });

  const client = await pool.connect();
  console.log(`\n🧹 Clearing ${countyName}...`);
  await client.query('DELETE FROM parcels WHERE county = $1', [countyName]);

  // 3. Stream SHP
  console.log(`\n🔗 Streaming Shapefile (Limit 50)...`);
  const source = await shapefile.open(shpPath);
  let batch = [];
  let loadedCount = 0;

  while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      const shpProps = feature.properties;
      const parcelId = shpProps.PARCEL_ID || shpProps.PARCELNO || shpProps.PIN || shpProps.RE;
      
      if (!parcelId) continue;

      if (loadedCount < 5 && !nalMap.has(parcelId)) {
           console.log(`Debug ID Mismatch: Shapefile '${parcelId}' not in NAL.`);
      }

      const nalData = nalMap.get(parcelId); 
      const geom = transformGeometry(feature.geometry);
      if (!geom) continue;

      const { lat, lon, acres } = getGeoStats(geom);

      const marketValue = parseFloat(nalData?.JV) || 0;
      const assessedValue = parseFloat(nalData?.AV_SD) || 0;
      const cleanAcres = acres || 0;
      const ownerState = nalData?.OWN_STATE || null;
      const outOfState = (ownerState && ownerState !== 'FL');
      
      const phyAddr = nalData?.PHY_ADDR1 ? `${nalData.PHY_ADDR1}, ${nalData.PHY_CITY || ''}, FL ${nalData.PHY_ZIP || ''}` : null;

      batch.push([
          countyName, parcelId, parcelId, nalData?.OWN_NAME || 'SAMPLE', nalData?.OWN_ADDR1, nalData?.OWN_CITY,
          ownerState, nalData?.OWN_ZIP, cleanAcres, phyAddr, nalData?.DOR_UC,
          assessedValue, marketValue, lat, lon, JSON.stringify(geom), outOfState, JSON.stringify(geom)
      ]);

      if (batch.length >= 50) break; 
  }

  if (batch.length > 0) {
      await insertBatch(client, batch);
      loadedCount += batch.length;
  }

  console.log(`\n\n✅ DONE! Total Loaded: ${loadedCount}`);
  client.release();
}

async function insertBatch(client, rows) {
    if (rows.length === 0) return;
    const cols = 18;
    const valuePlaceholders = [];
    const flatValues = [];
    for (let i = 0; i < rows.length; i++) {
        const offset = i * cols;
        const placeholders = [];
        for (let j = 1; j <= cols; j++) { 
            if (j === 18) {
                placeholders.push(`ST_SetSRID(ST_GeomFromGeoJSON($${offset + j}), 4326)`);
            } else {
                placeholders.push(`$${offset + j}`); 
            }
        }
        valuePlaceholders.push(`(${placeholders.join(',')})`);
        flatValues.push(...rows[i]);
    }
    const query = `
        INSERT INTO parcels (
          county, parcel_id, parcelno, own_name, own_addr1, own_city, 
          own_state, own_zipcd, acreage, phy_addr1, dor_uc, 
          av_sd, jv, latitude, longitude, geojson, out_of_state, geom
        ) VALUES ${valuePlaceholders.join(',')}
    `;

    try { await client.query(query, flatValues); } catch (e) { console.error('Batch Error:', e.message); }
}

loadSample().then(() => process.exit(0));
