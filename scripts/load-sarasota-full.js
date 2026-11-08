const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const turf = require('turf');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// node scripts/load-sarasota-full.js

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const PROJECTIONS = {
    'Florida_West': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs' 
};
let currentProj = PROJECTIONS['Florida_West']; 

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

function safeFloat(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const trimmed = String(val).trim();
    if (trimmed === '') return 0;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
}

async function loadFull() {
  const countyName = 'Sarasota';
  console.log(`\n🚀 Starting FULL Data Load for: ${countyName}`);
  
  const CSV_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\NAL68F202501.csv';
  const SHP_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\gis\\sarasota_2025par.shp';
  const PRJ_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\gis\\sarasota_2025par.prj';

  if (!fs.existsSync(CSV_FILE)) { console.error('CSV not found:', CSV_FILE); return; }
  if (!fs.existsSync(SHP_FILE)) { console.error('Shapefile not found:', SHP_FILE); return; }

  if (fs.existsSync(PRJ_FILE)) {
       const prjContent = fs.readFileSync(PRJ_FILE, 'utf8');
       console.log(`🌎 PRJ File Found: ${prjContent.substring(0, 50)}...`);
  }

  // 1. Load NAL into Map
  console.log(`\n📖 Reading Tax Roll (NAL)...`);
  const nalMap = new Map();
  let nalCount = 0;
  
  await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE)
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim()
        }))
        .on('data', (row) => {
            const id = row.PARCEL_ID;
            if (id) {
                nalMap.set(id, {
                    OWN_NAME: row.OWN_NAME,
                    OWN_ADDR1: row.OWN_ADDR1,
                    OWN_CITY: row.OWN_CITY,
                    OWN_STATE: row.OWN_STATE, 
                    OWN_ZIP: row.OWN_ZIPCD,
                    DOR_UC: row.DOR_UC,
                    JV: row.JV,
                    AV_SD: row.AV_SD,
                    PHY_ADDR1: row.PHY_ADDR1,
                    PHY_CITY: row.PHY_CITY,
                    PHY_ZIP: row.PHY_ZIPCD
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
  console.log(`\n🧹 Clearing ${countyName}...`);
  await client.query('DELETE FROM parcels WHERE county = $1', [countyName]);

  // 3. Stream SHP
  console.log(`\n🔗 Streaming Shapefile...`);
  const source = await shapefile.open(SHP_FILE);
  let batch = [];
  const BATCH_SIZE = 500; 
  const CHUNK_SIZE = 10000;
  let loadedCount = 0;
  let chunkCount = 0;

  while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      const shpProps = feature.properties;
      const parcelId = shpProps.PARCELID || shpProps.PARCEL_ID || shpProps.PARID || shpProps.PCN || shpProps.PARCELNO;
      
      if (!parcelId) continue;

      const nalData = nalMap.get(parcelId); 
      const geom = transformGeometry(feature.geometry);
      if (!geom) continue;

      const { lat, lon, acres } = getGeoStats(geom);

      const marketValue = safeFloat(nalData?.JV);
      const assessedValue = safeFloat(nalData?.AV_SD);
      const cleanAcres = acres || safeFloat(nalData?.ACREAGE);
      
      const ownerState = nalData?.OWN_STATE || null;
      const ownerZip = safeFloat(nalData?.OWN_ZIP);
      const outOfState = (ownerState && ownerState !== 'FL');
      
      const phyAddr = nalData?.PHY_ADDR1 ? `${nalData.PHY_ADDR1}, ${nalData.PHY_CITY || ''}, FL ${nalData.PHY_ZIP || ''}` : null;

      batch.push([
          countyName, parcelId, parcelId, nalData?.OWN_NAME, nalData?.OWN_ADDR1, nalData?.OWN_CITY,
          ownerState, ownerZip, cleanAcres, phyAddr, nalData?.DOR_UC,
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
                // Buffer(0) helps fix invalid geometries sometimes, but just ST_Multi is fine if source is valid.
                // Using only ST_Multi as requested.
                placeholders.push(`ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($${offset + j})), 4326)`);
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

    try { await client.query(query, flatValues); } 
    catch (e) { console.error('Batch Error:', e.message); }
}

loadFull().then(() => process.exit(0));
