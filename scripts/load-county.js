// scripts/load-county.js
console.log("Script process started...");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const turf = require('turf'); // uses 'turf' package v3 per package.json
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Define Projections
// EPSG:2236 - Florida North (Baker, Duval, etc)
// EPSG:2238 - Florida East (some other counties)
// We will assume 2236 for Baker/North FL for now, or detect based on county?
// Define Projections (NAD83 / Florida Feet)
// We define them but will SELECT based on .prj file content content.
const PROJECTIONS = {
    'Florida_North': '+proj=lcc +lat_1=29.58333333333333 +lat_2=30.75 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', // EPSG:2236
    'Florida_East': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs', // EPSG:2237
    'Florida_West': '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs'  // EPSG:2238
};

// Default fallback
let currentProj = PROJECTIONS['Florida_North'];

const BASE_DIR = 'D:/LandOracle/Florida';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper: Transform Geometry
function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;
  try {
    // Current proj -> WGS84
    const transform = (coord) => proj4(currentProj, 'EPSG:4326', coord);
    
    if (geom.type === 'Polygon') {
      return {
        type: 'Polygon',
        coordinates: geom.coordinates.map(ring => ring.map(transform))
      };
    } else if (geom.type === 'MultiPolygon') {
      return {
        type: 'MultiPolygon',
        coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(transform)))
      };
    }
  } catch (err) {
    return null;
  }
  return geom;
}

// Helper: Calculate Centroid & Acreage
function getGeoStats(geom) {
  if (!geom) return { lat: null, lon: null, acres: null };
  
  try {
    // Turf v3 uses point, polygon, feature...
    // Center calculation
    // 'turf.centroid' takes a feature
    const feature = { type: 'Feature', geometry: geom, properties: {} };
    const center = turf.centroid(feature);
    const lon = center.geometry.coordinates[0];
    const lat = center.geometry.coordinates[1];
    
    // Area calculation
    const areaSqMeters = turf.area(feature); // returns sq meters
    const acres = areaSqMeters * 0.000247105;
    
    return { lat, lon, acres };
  } catch (err) {
     return { lat: null, lon: null, acres: null };
  }
}

async function findFiles(countyName) {
  const countyDir = path.join(BASE_DIR, countyName);
  if (!fs.existsSync(countyDir)) return null;

  let nalPath = null;
  let shpPath = null;

  // Find NAL (CSV) in root
  const files = fs.readdirSync(countyDir);
  const csvFile = files.find(f => f.startsWith('NAL') && f.endsWith('.csv'));
  if (csvFile) nalPath = path.join(countyDir, csvFile);

  // Find SHP in gis/
  const gisDir = path.join(countyDir, 'gis');
  if (fs.existsSync(gisDir)) {
      const gFiles = fs.readdirSync(gisDir);
      const shpFile = gFiles.find(f => f.endsWith('.shp')); // PAR shapefile
      if (shpFile) shpPath = path.join(gisDir, shpFile);
  }
  
  return { nalPath, shpPath };
}

async function loadCounty(countyName) {
  console.log(`\n🚀 Starting Full Data Load via Option 2 for: ${countyName}`);
  
  const { nalPath, shpPath } = await findFiles(countyName);
  
  if (!nalPath) { console.error('❌ NAL CSV not found.'); return; }
  if (!shpPath) { console.error('❌ Shapefile not found.'); return; }
  
  console.log(`   NAL: ${nalPath}`);
  console.log(`   SHP: ${shpPath}`);

  // 0. Auto-Detect Projection
  try {
      const prjPath = shpPath.replace('.shp', '.prj');
      if (fs.existsSync(prjPath)) {
          const prjContent = fs.readFileSync(prjPath, 'utf8');
          if (prjContent.includes('Florida_North')) {
              console.log('🌎 Projection Detected: Florida North (LCC)');
              currentProj = PROJECTIONS['Florida_North'];
          } else if (prjContent.includes('Florida_East')) {
              console.log('🌎 Projection Detected: Florida East (T-Merc)');
              currentProj = PROJECTIONS['Florida_East'];
          } else if (prjContent.includes('Florida_West')) {
              console.log('🌎 Projection Detected: Florida West (T-Merc)');
              currentProj = PROJECTIONS['Florida_West'];
          } else {
              console.warn('⚠️ Unknown Projection in .prj file. Defaulting to Florida North.');
              console.log('   PRJ Content:', prjContent.substring(0, 100) + '...');
          }
      } else {
          console.warn('⚠️ No .prj file found. Defaulting to Florida North.');
      }
  } catch (e) {
      console.error('Error reading projection:', e);
  }

  // 1. Load NAL Data into Map
  const sanitizeNumeric = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
          if (val.trim() === '') return null;
          // Try to parse
          const num = Number(val);
          return isNaN(num) ? null : num;
      }
      if (typeof val === 'number') return isNaN(val) ? null : val;
      return null;
  };

  console.log(`\n📖 Reading Tax Roll (NAL) data...`);
  const nalMap = new Map();
  let nalCount = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(nalPath)
      .pipe(csv())
      .on('data', (row) => {
        try {
            let id = row.PARCEL_ID; 
            if (id) {
               // CLEANUP: Remove quotes and whitespace "12-34" -> 12-34
               id = id.replace(/["']/g, '').trim();

               // JOIN KEY: Normalized (Strip all non-alphanumeric) for reliable matching
               // Brevard NAL: "21 3529-02-*-11" -> "2135290211"
               let joinKey = id.replace(/[^a-zA-Z0-9]/g, '');

                    // Polk Specific Join Key
                    if (countyName === 'Polk' && row.STATE_PAR_ID) {
                          joinKey = row.STATE_PAR_ID.replace(/[^a-zA-Z0-9]/g, '');
                    }

                   // Optimization: Only store fields we use to save memory on large counties (Duval)
                   nalMap.set(joinKey, {
                       PARCEL_ID: row.PARCEL_ID, // Store for Polk override
                       OWN_NAME: row.OWN_NAME,
                       OWN_ADDR1: row.OWN_ADDR1,
                       OWN_CITY: row.OWN_CITY,
                       OWN_STATE: row.OWN_STATE,
                       OWN_ZIP: row.OWN_ZIP, // Note: inspect showed OWN_ZIPCD in Polk? Let's check keys.
                       OWN_ZIPCD: row.OWN_ZIPCD, // Add this just in case
                       DOR_UC: row.DOR_UC,
                       JV: row.JV,
                       AV_SD: row.AV_SD
                   });
               nalCount++;
            }
        } catch (err) {
            console.error('Error processing NAL row:', err, row);
        }
      })
      .on('end', () => {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`   ✅ Loaded ${nalCount.toLocaleString()} tax records into memory (~${Math.round(used)} MB used).`);
        resolve();
      })
      .on('error', reject);
  });

  // 2. Clear Database for County
  const client = await pool.connect();
  try {
      console.log(`\n🧹 Clearing existing DB records for ${countyName}...`);
      await client.query('DELETE FROM parcels WHERE county = $1', [countyName]);
  } catch(e) {
      console.error(e);
  }

  // 3. Process Shapefile & Join
  console.log(`\n🔗 Joining Spatial Data & Loading to DB...`);
  let loadedCount = 0;
  let skippedCount = 0;
  
  try {
    const source = await shapefile.open(shpPath);
    const batch = [];
    const BATCH_SIZE = 500;
    
    while(true) {
        const result = await source.read();
        if (result.done) break;
        
        const feature = result.value;
        const shpProps = feature.properties;
        const rawGeom = feature.geometry;
        
        // Prioritize standard PARCEL_ID or PARCELNO over ALT keys
        let parcelId = shpProps.PARCEL_ID || shpProps.PARCELNO || shpProps.PARID || shpProps.PIN || shpProps.PID || shpProps.ALTKEY || shpProps.ALT_KEY || shpProps.AKEY;
        
        if (!parcelId) { skippedCount++; continue; }

        // Brevard Fix: Replace spaces with dashes (21 3423 -> 21-34-23)
        // Also handle cases where Rng/Sec are joined?
        // Simple fix: Replace all spaces with dashes for consistency
        if (countyName === 'Brevard' && parcelId.includes(' ')) {
             // 21 3423-00-756 -> 21-3423-00-756 (Not quite right if 3423 is joined)
             // Let's just remove spaces? Or replace with dashes?
             // Standard format usually has dashes.
             // If input is "21 3529-02-*-11", replacing space gives "21-3529-02-*-11"
             // Ideally we want "21-35-29-02-*-11".
             // Let's just do a simple replace first.
             parcelId = parcelId.replace(/\s+/g, '-');
             
             // If format is "21-3529...", insert dash after 2nd digit of 2nd group?
             // Regex for "XX-XXXX..." -> "XX-XX-XX..."
             const match = parcelId.match(/^(\d{2})-(\d{2})(\d{2})-(.*)$/);
             if (match) {
                 parcelId = `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
             }
        }
        
        // Find NAL Data using NORMALIZED KEY
        let joinKey = parcelId.replace(/[^a-zA-Z0-9]/g, '');
        
        if (countyName === 'Polk') {
             // Polk uses STATE_PAR_ (C63...) for joining
             const statePar = shpProps.STATE_PAR_ || shpProps.STATE_PAR;
             if (statePar) {
                 joinKey = statePar.replace(/[^a-zA-Z0-9]/g, '');
             }
        }

        const nalData = nalMap.get(joinKey);
        
        // Polk: Override ID with NAL ID and Format
        if (countyName === 'Polk' && nalData && nalData.PARCEL_ID) {
             let rawId = nalData.PARCEL_ID.replace(/["']/g, '').trim();
             // Format: XX-XX-XX-XXXXXX-XXXXXX (18 digits)
             // Check if it's 18 digits
             const p = rawId.replace(/[^0-9]/g, '');
             if (p.length === 18) {
                 parcelId = `${p.slice(0,2)}-${p.slice(2,4)}-${p.slice(4,6)}-${p.slice(6,12)}-${p.slice(12)}`;
             } else {
                 parcelId = rawId;
             }
        }

        
        // Transform spatial
        const geom = transformGeometry(rawGeom);
        if (!geom) { skippedCount++; continue; }
        
        const { lat, lon, acres } = getGeoStats(geom);
        
        // Prepare Record
        // If NAL data missing, fields will be null
        const ownerName = nalData ? nalData.OWN_NAME : null;
        const ownerAddr = nalData ? nalData.OWN_ADDR1 : null;
        const ownerCity = nalData ? nalData.OWN_CITY : null;
        const ownerState = nalData ? nalData.OWN_STATE : null;
        let ownerZip = nalData ? (nalData.OWN_ZIP || nalData.OWN_ZIPCD) : null;
        if (ownerZip && typeof ownerZip === 'string' && ownerZip.trim() === '') {
            ownerZip = null;
        }
        
        const landUse = nalData ? nalData.DOR_UC : null;
        const marketValue = nalData ? (parseInt(nalData.JV) || 0) : 0;
        const assessedValue = nalData ? (parseInt(nalData.AV_SD) || 0) : 0;
        
        // Determine Out of State
        let isOutOfState = false;
        if (ownerState && ownerState !== 'FL' && ownerState !== 'Florida') {
            isOutOfState = true;
        }

        // Capture AltKey for deep linking if available
        const altKey = shpProps.ALT_KEY || shpProps.ALTKEY || shpProps.AKEY || null;
        const finalParcelNo = altKey ? altKey.toString() : parcelId;

        batch.push([
            countyName, parcelId, finalParcelNo, ownerName, ownerAddr, ownerCity, 
            ownerState, sanitizeNumeric(ownerZip), sanitizeNumeric(acres), null /* prop addr separate? */, landUse,
            sanitizeNumeric(assessedValue), sanitizeNumeric(marketValue), sanitizeNumeric(lat), sanitizeNumeric(lon), JSON.stringify(geom), isOutOfState
        ]);
        
        if (batch.length >= BATCH_SIZE) {
            await insertBatch(client, batch);
            loadedCount += batch.length;
            batch.length = 0;
            process.stdout.write(`\r   Loaded ${loadedCount} merged records...`);
            
            // Limit Check
            if (process.env.LIMIT && loadedCount >= parseInt(process.env.LIMIT)) {
                console.log(`\n🛑 Reached limit of ${process.env.LIMIT} records. Stopping.`);
                break;
            }
        }
    }
    
    if (batch.length > 0) {
        await insertBatch(client, batch);
        loadedCount += batch.length;
    }
    
    console.log(`\n\n✅ Success! Loaded ${loadedCount.toLocaleString()} parcels for ${countyName}.`);
    console.log(`   (Skipped ${skippedCount} due to missing ID/Geom)`);
    
    if (loadedCount === 0 && skippedCount > 100) {
        console.warn('⚠️ WARNING: 0 records loaded but many skipped. Possible ID format mismatch between CSV and Shapefile.');
    }
    
  } catch (err) {
      console.error('Error processing shapefile:', err);
  } finally {
      client.release();
  }
}

async function insertBatch(client, rows) {
    if (rows.length === 0) return;
    
    // Construct ONE insert statement with multiple value sets
    // ($1..$16), ($17..$32), etc.
    const cols = 17;
    const valuePlaceholders = [];
    const flatValues = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const offset = i * cols;
        const placeholders = [];
        for (let j = 1; j <= cols; j++) {
            placeholders.push(`$${offset + j}`);
        }
        valuePlaceholders.push(`(${placeholders.join(',')})`);
        // ID is duplicated to both columns for safety
        flatValues.push(...row);
        // We need to inject 'parcelId' (index 1) again into 'parcelno' position?
        // Wait, 'row' already has 16 items. If we add a column to INSERT, we need to add it to 'placeholders' logic too.
        // Actually, easier to just push it into 'batch' array in loadCounty function.

    }
    
    const query = `
        INSERT INTO parcels (
          county, parcel_id, parcelno, own_name, own_addr1, own_city,
          own_state, own_zipcd, acreage, phy_addr1, dor_uc,
          av_sd, jv, latitude, longitude, geojson, out_of_state, 
          geom
        ) VALUES ${valuePlaceholders.map(ph => {
            // we need to inject the ST_Geom call into the values list
            // The last placeholder in the list is the JSON string (index 15, or $15)
            // But wait, the placeholder list is just ($1,$2,$3...).
            // We can't easily modify the generated string "$1,$2..." to wrap one item.
            // EASIER: We just append the function call to the end of the VALUES list
            // The placeholders are 1-16. We need the 17th value to be the function using the 15th param.
            // ph is "(... $15, $16)" -> needs to become "(... $15, $16, ST_SetSRID(ST_GeomFromGeoJSON($15), 4326))"
            
            // Extract the placeholders string inside parens
            const content = ph.substring(1, ph.length - 1); // "$1,$2...$16"
            const parts = content.split(',');
            const jsonParam = parts[15]; // Index 15 is the 16th element (geojson)
            return `(${content}, ST_SetSRID(ST_GeomFromGeoJSON(${jsonParam}), 4326))`;
        }).join(',')}
        ON CONFLICT (county, parcel_id) DO NOTHING
    `;

    try {
        await client.query('BEGIN');
        await client.query(query, flatValues);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Batch insert failed:', e.message);
        throw e; // Fail hard to notice
    }
}

// Run
// Run
const target = process.argv[2];
const limitArg = process.argv[3];
if (limitArg) process.env.LIMIT = limitArg;

if (target) {
    loadCounty(target).then(() => {
        pool.end(); 
        process.exit(0);
    });
} else {
    console.log('Usage: node scripts/load-county.js "CountyName" [Limit]');
    pool.end();
}
