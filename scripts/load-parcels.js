require('dotenv').config({ path: '../.env.local' });
const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const Papa = require('papaparse');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('sslmode=require', ''),
  ssl: {
    rejectUnauthorized: false
  }
});

const FLORIDA_COUNTIES_PATH = 'D:\\LandOracle\\Florida';

// Target counties
const TARGET_COUNTIES = [
  'Duval'
];

// Large counties that need chunked processing
const LARGE_COUNTIES = ['Duval', 'Miami-Dade', 'Broward', 'Palm Beach'];

async function loadCounty(countyName) {
  // Use chunked loader for large counties
  if (LARGE_COUNTIES.includes(countyName)) {
    return await loadCountyChunked(countyName);
  }
  
  // Regular loader for normal counties
  console.log(`\n📍 Processing ${countyName} County...`);
  
  const countyPath = path.join(FLORIDA_COUNTIES_PATH, countyName);
  
  const nalFiles = fs.readdirSync(countyPath).filter(f => f.startsWith('NAL') && f.endsWith('.csv'));
  if (nalFiles.length === 0) {
    console.log(`❌ No NAL file found`);
    return;
  }
  
  const nalPath = path.join(countyPath, nalFiles[0]);
  
  const gisPath = path.join(countyPath, 'gis');
  if (!fs.existsSync(gisPath)) {
    console.log(`❌ No gis folder`);
    return;
  }
  
  const parFiles = fs.readdirSync(gisPath).filter(f => f.toLowerCase().includes('par') && f.endsWith('.shp'));
  if (parFiles.length === 0) {
    console.log(`❌ No PAR shapefile`);
    return;
  }
  
  const parPath = path.join(gisPath, parFiles[0]);
  
  console.log(`📄 Reading NAL data...`);
  const nalData = await readNAL(nalPath);
  console.log(`   Found ${nalData.length} NAL records`);
  
  console.log(`🗺️  Reading PAR shapefile...`);
  const parData = await readPAR(parPath);
  console.log(`   Found ${parData.length} PAR records`);
  
  console.log(`🔗 Joining NAL + PAR data...`);
  const parcels = joinNALandPAR(nalData, parData, countyName);
  
  console.log(`✅ Found ${parcels.length} parcels to load`);
  
  if (parcels.length > 0) {
    const inserted = await insertParcelsBatch(parcels);
    console.log(`💾 Inserted ${inserted} parcels`);
  }
}

async function loadCountyChunked(countyName) {
  console.log(`\n📍 Processing ${countyName} County (CHUNKED MODE - Large County)...`);
  
  const countyPath = path.join(FLORIDA_COUNTIES_PATH, countyName);
  
  const nalFiles = fs.readdirSync(countyPath).filter(f => f.startsWith('NAL') && f.endsWith('.csv'));
  if (nalFiles.length === 0) {
    console.log(`❌ No NAL file found`);
    return;
  }
  
  const nalPath = path.join(countyPath, nalFiles[0]);
  
  const gisPath = path.join(countyPath, 'gis');
  if (!fs.existsSync(gisPath)) {
    console.log(`❌ No gis folder`);
    return;
  }
  
  const parFiles = fs.readdirSync(gisPath).filter(f => f.toLowerCase().includes('par') && f.endsWith('.shp'));
  if (parFiles.length === 0) {
    console.log(`❌ No PAR shapefile`);
    return;
  }
  
  const parPath = path.join(gisPath, parFiles[0]);
  
  console.log(`📄 Reading NAL data...`);
  const nalData = await readNAL(nalPath);
  console.log(`   Found ${nalData.length} NAL records`);
  
  // Create NAL lookup map
  const nalMap = new Map();
  nalData.forEach(nal => {
    const key = nal.DOR || nal.PARCEL_ID || (nal.CO_NO && nal.PARCEL_ID ? nal.CO_NO + nal.PARCEL_ID : null);
    if (key) nalMap.set(key.toString().trim(), nal);
  });
  
  console.log(`🗺️  Streaming PAR shapefile in chunks...`);
  
  // Stream and process PAR in chunks
  const source = await shapefile.open(parPath);
  let chunk = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  const CHUNK_SIZE = 50000;
  
  while (true) {
    const result = await source.read();
    
    if (result.done) {
      // Process final chunk
      if (chunk.length > 0) {
        console.log(`   Processing final chunk of ${chunk.length} features...`);
        const parcels = processChunk(chunk, nalMap, countyName);
        if (parcels.length > 0) {
          const inserted = await insertParcelsBatch(parcels);
          totalInserted += inserted;
        }
        totalProcessed += chunk.length;
      }
      break;
    }
    
    chunk.push(result.value);
    
    // When chunk is full, process and insert
    if (chunk.length >= CHUNK_SIZE) {
      console.log(`   Processing chunk: ${totalProcessed} -> ${totalProcessed + chunk.length} features...`);
      const parcels = processChunk(chunk, nalMap, countyName);
      
      if (parcels.length > 0) {
        const inserted = await insertParcelsBatch(parcels);
        totalInserted += inserted;
      }
      
      totalProcessed += chunk.length;
      chunk = []; // Clear chunk from memory
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  console.log(`✅ Completed ${countyName}: Processed ${totalProcessed} features, inserted ${totalInserted} parcels`);
}

function processChunk(parFeatures, nalMap, countyName) {
  const parcels = [];
  
  parFeatures.forEach(parFeature => {
    if (!parFeature || !parFeature.properties) return;
    
    const props = parFeature.properties;
    const key = props.DOR || props.PARCEL_ID || (props.CO_NO && props.PARCEL_ID ? props.CO_NO + props.PARCEL_ID : null);
    
    if (!key) return;
    
    const nal = nalMap.get(key.toString().trim());
    if (!nal) return;
    
    let latitude = null;
    let longitude = null;
    
    try {
      if (parFeature.geometry && parFeature.geometry.coordinates) {
        let coords = parFeature.geometry.coordinates;
        
        if (parFeature.geometry.type === 'MultiPolygon') {
          coords = coords[0];
        }
        
        if (coords && coords[0] && Array.isArray(coords[0])) {
          const ring = coords[0];
          const lats = ring.map(c => c[1]).filter(v => !isNaN(v));
          const lngs = ring.map(c => c[0]).filter(v => !isNaN(v));
          
          if (lats.length > 0 && lngs.length > 0) {
            latitude = lats.reduce((a, b) => a + b) / lats.length;
            longitude = lngs.reduce((a, b) => a + b) / lngs.length;
          }
        }
      }
    } catch (e) {}
    
    let acreage = 0;
    if (nal.TOT_LVL_AREA) {
      acreage = parseFloat(nal.TOT_LVL_AREA) / 43560;
    } else if (nal.LND_SQFOOT) {
      acreage = parseFloat(nal.LND_SQFOOT) / 43560;
    }
    
    const ownerState = (nal.OWNER_STATE || nal.OWN_STATE || nal.MAIL_STATE || '').trim().toUpperCase();
    const truncatedState = ownerState ? ownerState.substring(0, 2) : null;
    const outOfState = ownerState && ownerState !== 'FL' && ownerState !== '' ? true : false;
    
    parcels.push({
      parcel_id: countyName + '-' + key.toString().trim(),
      county: countyName,
      owner_name: nal.OWNER_NAME || nal.OWN_NAME || null,
      owner_address: nal.OWNER_ADDR || nal.OWN_ADDR1 || null,
      owner_city: nal.OWNER_CITY || nal.OWN_CITY || null,
      owner_state: truncatedState,
      owner_zip: nal.OWNER_ZIP || nal.OWN_ZIP || null,
      out_of_state: outOfState,
      acreage: acreage,
      property_address: nal.SITUS_ADDR || nal.PHY_ADDR1 || null,
      land_use: nal.DOR_UC || nal.ACT_USE || null,
      assessed_value: parseFloat(nal.JV || nal.ASSESSED_VAL || 0),
      market_value: parseFloat(nal.JV || nal.MARKET_VAL || 0),
      latitude,
      longitude,
      geojson: parFeature
    });
  });
  
  return parcels;
}

async function readNAL(filePath) {
  return new Promise((resolve, reject) => {
    const csvData = fs.readFileSync(filePath, 'utf8');
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    });
  });
}

async function readPAR(filePath) {
  const features = [];
  const source = await shapefile.open(filePath);
  
  let result = await source.read();
  while (!result.done) {
    features.push(result.value);
    result = await source.read();
  }
  
  return features;
}

function joinNALandPAR(nalRecords, parFeatures, countyName) {
  const nalMap = new Map();
  
  nalRecords.forEach(nal => {
    const key = nal.DOR || nal.PARCEL_ID || (nal.CO_NO && nal.PARCEL_ID ? nal.CO_NO + nal.PARCEL_ID : null);
    if (key) nalMap.set(key.toString().trim(), nal);
  });
  
  return processChunk(parFeatures, nalMap, countyName);
}

async function insertParcelsBatch(parcels) {
  const client = await pool.connect();
  let inserted = 0;
  const batchSize = 1000;
  
  try {
    for (let i = 0; i < parcels.length; i += batchSize) {
      const batch = parcels.slice(i, i + batchSize);
      
      const values = [];
      const params = [];
      let paramIndex = 1;
      
      for (const parcel of batch) {
        const cleanAcreage = Math.min(Math.abs(parseFloat(parcel.acreage) || 0), 99999);
        const cleanAssessed = Math.min(Math.abs(parseFloat(parcel.assessed_value) || 0), 999999999);
        const cleanMarket = Math.min(Math.abs(parseFloat(parcel.market_value) || 0), 999999999);
        
        let cleanLat = null;
        let cleanLng = null;
        
        if (parcel.latitude && !isNaN(parcel.latitude)) {
          cleanLat = Math.max(-90, Math.min(90, parseFloat(parcel.latitude)));
        }
        if (parcel.longitude && !isNaN(parcel.longitude)) {
          cleanLng = Math.max(-180, Math.min(180, parseFloat(parcel.longitude)));
        }
        
        values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15})`);
        
        params.push(
          parcel.parcel_id, parcel.county, parcel.owner_name, parcel.owner_address,
          parcel.owner_city, parcel.owner_state, parcel.owner_zip, parcel.out_of_state,
          cleanAcreage, parcel.property_address, parcel.land_use, cleanAssessed,
          cleanMarket, cleanLat, cleanLng, JSON.stringify(parcel.geojson)
        );
        
        paramIndex += 16;
      }
      
      await client.query(`
        INSERT INTO parcels (
          parcel_id, county, owner_name, owner_address, owner_city, 
          owner_state, owner_zip, out_of_state, acreage, property_address,
          land_use, assessed_value, market_value, latitude, longitude, geojson
        ) VALUES ${values.join(', ')}
        ON CONFLICT (parcel_id) DO NOTHING
      `, params);
      
      inserted += batch.length;
    }
  } finally {
    client.release();
  }
  
  return inserted;
}

async function main() {
  const allCounties = fs.readdirSync(FLORIDA_COUNTIES_PATH);
  const counties = allCounties.filter(c => TARGET_COUNTIES.includes(c));
  
  console.log(`🚀 Starting Florida parcel data import...`);
  console.log(`📊 Loading ${counties.length} priority counties: ${counties.join(', ')}\n`);
  
  for (const county of counties) {
    try {
      await loadCounty(county);
    } catch (error) {
      console.error(`❌ Error processing ${county}: ${error.message}`);
    }
  }
  
  const result = await pool.query('SELECT COUNT(*) FROM parcels');
  console.log(`\n✅ Import complete! Total parcels in database: ${result.rows[0].count}`);
  
  const byCounty = await pool.query('SELECT county, COUNT(*) as count FROM parcels GROUP BY county ORDER BY county');
  console.log(`\n📊 Parcels by county:`);
  byCounty.rows.forEach(row => {
    console.log(`   ${row.county}: ${row.count}`);
  });
  
  await pool.end();
}

main();