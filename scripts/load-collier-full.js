const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const turf = require('turf');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/load-collier-full.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
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

async function loadFull() {
  const countyName = 'Collier';
  console.log(`\n🚀 Starting FULL Data Load for: ${countyName}`);
  const BASE_DIR = 'D:/LandOracle/Florida/Collier';
  
  if (!fs.existsSync(BASE_DIR)) { console.error('County dir not found'); return; }
  const files = fs.readdirSync(BASE_DIR);
  // Collier uses NAL21...
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
                    AV_SD: row.AV_SD
                });
                nalCount++;
            }
        })
        .on('end', () => {
             const used = process.memoryUsage().heapUsed / 1024 / 1024;
             console.log(`   ✅ Loaded ${nalCount.toLocaleString()} NAL records (~${Math.round(used)} MB heap).`);
             resolve();
        })
        .on('error', reject);
  });

  const client = await pool.connect();
  // console.log(`\n🧹 Clearing ${countyName}...`);
  // await client.query('DELETE FROM parcels WHERE county = $1', [countyName]);
  
  console.log('Fetching existing IDs to resume...');
  const existingRes = await client.query("SELECT parcel_id FROM parcels WHERE county = 'Collier'");
  const existingIds = new Set(existingRes.rows.map(r => r.parcel_id));
  console.log(`Found ${existingIds.size} existing records. Resuming...`);

  // 3. Stream SHP
  console.log(`\n🔗 Streaming Shapefile...`);
  const source = await shapefile.open(shpPath);
  let batch = [];
  const BATCH_SIZE = 1000;
  const CHUNK_SIZE = 50000;
  let loadedCount = 0;
  let chunkCount = 0;

  while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      const shpProps = feature.properties;
      const parcelId = shpProps.PARCEL_ID || shpProps.PARCELNO || shpProps.PIN || shpProps.RE;
      
      if (!parcelId) continue;
      
      if (existingIds.has(parcelId)) {
        // skipped++; 
        continue;
      }

      // No special key needed for Collier (Manual Search uses ID)
      const nalData = nalMap.get(parcelId); 
      const geom = transformGeometry(feature.geometry);
      if (!geom) continue;

      const { lat, lon, acres } = getGeoStats(geom);

      const marketValue = parseFloat(nalData?.JV) || 0;
      const assessedValue = parseFloat(nalData?.AV_SD) || 0;
      const cleanAcres = acres || 0;
      const ownerState = nalData?.OWN_STATE || null;
      const outOfState = (ownerState && ownerState !== 'FL');
      
      // Deduplicate within batch to prevent "ON CONFLICT... row a second time" error
      // Check if we've already added this parcelId to the current batch
      const isDuplicate = batch.some(row => row[1] === parcelId); // row[1] is parcel_id
      if (isDuplicate) continue;

      batch.push([
          countyName, parcelId, parcelId, nalData?.OWN_NAME, nalData?.OWN_ADDR1, nalData?.OWN_CITY,
          ownerState, nalData?.OWN_ZIP, cleanAcres, null, nalData?.DOR_UC,
          assessedValue, marketValue, lat, lon, JSON.stringify(geom), outOfState, JSON.stringify(geom)
      ]);

      if (batch.length >= BATCH_SIZE) {
          await insertBatch(client, batch);
          loadedCount += batch.length;
          chunkCount += batch.length;
          batch = [];

          if (chunkCount >= CHUNK_SIZE) {
              if (global.gc) global.gc(); 
              chunkCount = 0;
              const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
              process.stdout.write(`\r   Loaded ${loadedCount.toLocaleString()}... (GC Triggered - ${mem} MB)`);
          } else {
              process.stdout.write(`\r   Loaded ${loadedCount.toLocaleString()}...`);
          }
      }
  }

  if (batch.length > 0) {
      await insertBatch(client, batch);
      loadedCount += batch.length;
  }

  console.log(`\n\n✅ DONE! Total Loaded: ${loadedCount.toLocaleString()}`);
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
        ON CONFLICT (parcel_id) DO UPDATE SET
            own_name = EXCLUDED.own_name,
            own_addr1 = EXCLUDED.own_addr1,
            own_city = EXCLUDED.own_city,
            own_state = EXCLUDED.own_state,
            own_zipcd = EXCLUDED.own_zipcd,
            acreage = EXCLUDED.acreage,
            phy_addr1 = EXCLUDED.phy_addr1,
            dor_uc = EXCLUDED.dor_uc,
            av_sd = EXCLUDED.av_sd,
            jv = EXCLUDED.jv,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            geojson = EXCLUDED.geojson,
            out_of_state = EXCLUDED.out_of_state,
            geom = EXCLUDED.geom
    `;

    try { await client.query(query, flatValues); } catch (e) { console.error('Batch Error:', e.message); }
}

loadFull().then(() => process.exit(0));
