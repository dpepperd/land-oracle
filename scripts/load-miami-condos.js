const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const turf = require('turf');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Memory limit handling: node --max-old-space-size=8192 scripts/load-miami-condos.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Projections
const PROJECTIONS = {
    'Florida_North': '+proj=lcc +lat_1=29.58333333333333 +lat_2=30.75 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', // EPSG:2236
    'Florida_East': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', // EPSG:2237
    'Florida_West': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs'  // EPSG:2238
};
let currentProj = PROJECTIONS['Florida_North'];

// Helper: Transform Geometry
function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;
  try {
    const transform = (coord) => proj4(currentProj, 'EPSG:4326', coord);
    
    if (geom.type === 'Point') {
        const p = transform(geom.coordinates);
        // Create a small box around it (Buffer ~5m)
        const size = 0.00005; 
        return {
            type: 'Polygon',
            coordinates: [[
                [p[0]-size, p[1]-size],
                [p[0]+size, p[1]-size],
                [p[0]+size, p[1]+size],
                [p[0]-size, p[1]+size],
                [p[0]-size, p[1]-size]
            ]]
        };
    } else if (geom.type === 'Polygon') {
      return { type: 'Polygon', coordinates: geom.coordinates.map(ring => ring.map(transform)) };
    } else if (geom.type === 'MultiPolygon') {
      return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(transform))) };
    }
  } catch (err) { return null; }
  return geom;
}

// Helper: Centroid
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

async function loadMiamiCondos() {
  const countyName = 'Miami-Dade';
  console.log(`\n🚀 Starting MIAMI CONDO Data Append`);
  const BASE_DIR = 'D:/LandOracle/Florida/Miami-Dade';
  
  // Find NAL
  if (!fs.existsSync(BASE_DIR)) { console.error('County dir not found'); return; }
  const files = fs.readdirSync(BASE_DIR);
  const csvFile = files.find(f => f.startsWith('NAL') && f.endsWith('.csv'));
  const nalPath = path.join(BASE_DIR, csvFile);
  
  const condoDir = path.join(BASE_DIR, 'gis_condos');
  const shpFile = 'miamidade_condos_2025par.shp'; // Hardcoded based on findings
  const shpPath = path.join(condoDir, shpFile);
  
  if (!fs.existsSync(nalPath)) { console.error('NAL File not found'); return; }
  if (!fs.existsSync(shpPath)) { console.error('Shapefile not found'); return; }

  // Projection Detection
  const prjPath = shpPath.replace('.shp', '.prj');
  if (fs.existsSync(prjPath)) {
       const prjContent = fs.readFileSync(prjPath, 'utf8');
       if (prjContent.includes('Florida_East')) currentProj = PROJECTIONS['Florida_East'];
       else if (prjContent.includes('Florida_West')) currentProj = PROJECTIONS['Florida_West'];
       else currentProj = PROJECTIONS['Florida_North'];
       console.log(`🌎 Projection: ${currentProj === PROJECTIONS['Florida_East'] ? 'East' : currentProj === PROJECTIONS['Florida_West'] ? 'West' : 'North'}`);
  }

  // 1. Load NAL into Map (Memory Efficient)
  console.log(`\n📖 Reading Tax Roll (NAL)...`);
  const nalMap = new Map();
  let nalCount = 0;
  
  await new Promise((resolve, reject) => {
      fs.createReadStream(nalPath)
        .pipe(csv())
        .on('data', (row) => {
            const id = row.PARCEL_ID;
            if (id) {
                // Store minimal data
                nalMap.set(id, {
                    OWN_NAME: row.OWN_NAME,
                    OWN_ADDR1: row.OWN_ADDR1,
                    OWN_CITY: row.OWN_CITY,
                    OWN_STATE: row.OWN_STATE ? row.OWN_STATE.substring(0, 2) : null, 
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
  // SKIPPED DELETE - This is an append

  // 3. Stream SHP in chunks
  console.log(`\n🔗 Streaming Condo Shapefile...`);
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

      const nalData = nalMap.get(parcelId);
      const geom = transformGeometry(feature.geometry);
      if (!geom) continue; // Skip failed transforms or unknown types

      const { lat, lon, acres } = getGeoStats(geom);

      // Data Cleaning
      const marketValue = Math.min(parseFloat(nalData?.JV) || 0, 9999999999);
      const assessedValue = Math.min(parseFloat(nalData?.AV_SD) || 0, 9999999999);
      const cleanAcres = Math.min(acres || 0, 999999);
      
      const ownerState = nalData?.OWN_STATE || null;
      const outOfState = (ownerState && ownerState !== 'FL') ? true : false;
      
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
              process.stdout.write(`\r   Loaded ${loadedCount.toLocaleString()} condos... (GC Triggered - ${mem} MB)`);
          } else {
              process.stdout.write(`\r   Loaded ${loadedCount.toLocaleString()} condos...`);
          }
      }
  }

  if (batch.length > 0) {
      await insertBatch(client, batch);
      loadedCount += batch.length;
  }

  console.log(`\n\n✅ DONE! Total Condos Loaded: ${loadedCount.toLocaleString()}`);
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
                // FIXED: Enforce MultiPolygon
                placeholders.push(`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${offset + j}), 4326))`);
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

    try { await client.query('BEGIN'); await client.query(query, flatValues); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); console.error('Batch Error (Skipping):', e.message); }
}

loadMiamiCondos().then(() => process.exit(0));
