const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const Papa = require('papaparse');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// CONFIGURATION
const FLORIDA_COUNTIES_PATH = 'D:\\LandOracle\\Florida';
const CHUNK_SIZE = 50000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🚀 Starting Autopilot Parcel Loader...');

  // 1. Verify Source Directory
  if (!fs.existsSync(FLORIDA_COUNTIES_PATH)) {
    console.error(`❌ Source directory not found: ${FLORIDA_COUNTIES_PATH}`);
    process.exit(1);
  }

  // 2. Get Existing Counties from DB
  const client = await pool.connect();
  let existingCounties = new Set();
  try {
    const res = await client.query('SELECT DISTINCT county FROM parcels');
    res.rows.forEach(r => existingCounties.add(r.county.toLowerCase())); // Normalize casing
    console.log(`📊 Found ${existingCounties.size} counties already in database.`);
  } finally {
    client.release();
  }

  // 3. Scan for Candidates
  const folders = fs.readdirSync(FLORIDA_COUNTIES_PATH);
  const queue = [];

  for (const folder of folders) {
    // Skip if already in DB (case-insensitive check)
    if (existingCounties.has(folder.toLowerCase())) {
        continue;
    }

    const countyPath = path.join(FLORIDA_COUNTIES_PATH, folder);
    if (!fs.statSync(countyPath).isDirectory()) continue;

    const nalFiles = fs.readdirSync(countyPath).filter(f => f.startsWith('NAL') && f.endsWith('.csv'));
    const gisPath = path.join(countyPath, 'gis');
    
    // Check constraints
    if (nalFiles.length > 0 && fs.existsSync(gisPath)) {
        const parFiles = fs.readdirSync(gisPath).filter(f => f.toLowerCase().includes('par') && f.endsWith('.shp'));
        if (parFiles.length > 0) {
            queue.push({
                name: folder,
                nalPath: path.join(countyPath, nalFiles[0]),
                parPath: path.join(gisPath, parFiles[0])
            });
        }
    }
  }

  console.log(`📋 Queue: ${queue.length} new counties found.`);
  queue.forEach(q => console.log(`   - ${q.name}`));

  if (queue.length === 0) {
      console.log('✅ All valid counties in folder are already loaded.');
      await pool.end();
      return;
  }

  console.log('\n⏳ Starting Batch Import in 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  // 4. Process Queue
  for (const job of queue) {
      console.log(`\n==================================================`);
      console.log(`📍 Processing: ${job.name}`);
      console.log(`==================================================`);
      
      try {
          await processCounty(job.name, job.nalPath, job.parPath);
          console.log(`✅ successfully loaded: ${job.name}`);
      } catch (err) {
          console.error(`❌ FAILED: ${job.name}`, err);
          // Continue to next county despite failure
      }

      // Force GC
      if (global.gc) global.gc();
  }

  console.log('\n🎉 AUTOPILOT COMPLETE.');
  await pool.end();
}

async function processCounty(countyName, nalPath, parPath) {
  // 1. Read NAL
  console.log(`📄 Reading NAL...`);
  const nalData = await readNAL(nalPath);
  console.log(`   rows: ${nalData.length}`);

  // 2. Build Lookup Map
  const nalMap = new Map();
  nalData.forEach(nal => {
      // Key Logic: Try formatting variants
      // 1. DOR Code
      // 2. PARCEL_ID
      // 3. CO_NO + PARCEL_ID
      const key1 = nal.DOR;
      const key2 = nal.PARCEL_ID;
      const key3 = (nal.CO_NO && nal.PARCEL_ID) ? nal.CO_NO + nal.PARCEL_ID : null;

      if (key1) nalMap.set(key1.toString().trim(), nal);
      if (key2) nalMap.set(key2.toString().trim(), nal);
      if (key3) nalMap.set(key3.toString().trim(), nal);
  });

  // 3. Stream Shapefile
  console.log(`🗺️  Streaming Shapefile...`);
  const source = await shapefile.open(parPath);
  
  let chunk = [];
  let totalInserted = 0;

  while (true) {
      const result = await source.read();
      if (result.done) {
          if (chunk.length > 0) {
              totalInserted += await flushChunk(chunk, nalMap, countyName);
          }
          break;
      }

      chunk.push(result.value);
      if (chunk.length >= CHUNK_SIZE) {
          totalInserted += await flushChunk(chunk, nalMap, countyName);
          chunk = [];
          if (global.gc) global.gc();
      }
  }
  
  console.log(`   Total Inserted: ${totalInserted}`);
}

async function flushChunk(parFeatures, nalMap, countyName) {
    const parcels = [];
    
    for (const feature of parFeatures) {
        if (!feature || !feature.properties) continue;

        const props = feature.properties;
        // Lookup Keys from Shapefile Props
        const k1 = props.DOR;
        const k2 = props.PARCEL_ID;
        const k3 = (props.CO_NO && props.PARCEL_ID) ? props.CO_NO + props.PARCEL_ID : null;
        
        let nal = null;
        if (k1 && nalMap.has(k1.toString().trim())) nal = nalMap.get(k1.toString().trim());
        else if (k2 && nalMap.has(k2.toString().trim())) nal = nalMap.get(k2.toString().trim());
        else if (k3 && nalMap.has(k3.toString().trim())) nal = nalMap.get(k3.toString().trim());

        if (!nal) continue; // Skip orphan geometries

        // Centroid Calc
        let lat = null, lon = null;
        try {
            if (feature.geometry && feature.geometry.coordinates) {
                 // Simple centroid approximation for point/poly
                 // Turf check usually better but avoiding heavy deps here if possible
                 // Fallback to simple average of first ring
                 let ring = feature.geometry.coordinates;
                 if (feature.geometry.type === 'MultiPolygon') ring = ring[0];
                 if (Array.isArray(ring[0])) ring = ring[0]; // Outer ring
                 
                 if (Array.isArray(ring) && ring.length > 0) {
                     const lats = ring.map(c => c[1]);
                     const lons = ring.map(c => c[0]);
                     lat = lats.reduce((a,b)=>a+b,0)/lats.length;
                     lon = lons.reduce((a,b)=>a+b,0)/lons.length;
                 }
            }
        } catch(e) {}

        parcels.push({
            id: `${countyName}-${props.PARCEL_ID || props.DOR || Math.random()}`,
            county: countyName,
            owner: nal.OWNER_NAME || nal.OWN_NAME,
            addr: nal.SITUS_ADDR || nal.PHY_ADDR1,
            val: parseFloat(nal.JV || nal.ASSESSED_VAL || 0),
            lat: lat,
            lon: lon,
            geo: feature.geometry,
            raw: nal
        });
    }

    if (parcels.length === 0) return 0;

    const client = await pool.connect();
    try {
        // Construct Bulk Insert
        // Using same schema as load-parcels.js
        // Mapped fields:
        // parcel_id, county, owner_name, owner_address, owner_city, owner_state, owner_zip, 
        // out_of_state, acreage, property_address, land_use, assessed_value, market_value, lat, lon, geojson
        
        for (let i=0; i<parcels.length; i+=1000) {
            const batch = parcels.slice(i, i+1000);
            const params = [];
            const placeholders = [];
            
            batch.forEach((p, idx) => {
                const offset = idx * 16;
                const nal = p.raw;
                const acreage = parseFloat(nal.TOT_LVL_AREA || nal.LND_SQFOOT || 0) / 43560;
                
                params.push(
                    p.id, p.county, p.owner, nal.OWNER_ADDR || nal.OWN_ADDR1,
                    nal.OWNER_CITY || nal.OWN_CITY, nal.OWNER_STATE || nal.OWN_STATE, nal.OWNER_ZIP || nal.OWN_ZIP,
                    (nal.OWNER_STATE !== 'FL' && nal.OWNER_STATE != null), // out_of_state
                    acreage, p.addr, nal.DOR_UC || nal.ACT_USE,
                    p.val, parseFloat(nal.JV || nal.MARKET_VAL || 0),
                    p.lat, p.lon, JSON.stringify(p.geo)
                );
                
                placeholders.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11}, $${offset+12}, $${offset+13}, $${offset+14}, $${offset+15}, $${offset+16})`);
            });

            const query = `
                INSERT INTO parcels (
                    parcel_id, county, owner_name, owner_address, owner_city, 
                    owner_state, owner_zip, out_of_state, acreage, property_address,
                    land_use, assessed_value, market_value, latitude, longitude, geojson
                ) VALUES ${placeholders.join(', ')}
                ON CONFLICT (parcel_id) DO NOTHING
            `;
            await client.query(query, params);
        }
        return parcels.length;
    } finally {
        client.release();
    }
}

function readNAL(filePath) {
    return new Promise((resolve) => {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => resolve(res.data),
            error: () => resolve([])
        });
    });
}

main();
