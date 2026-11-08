// scripts/test-county-coordinates.js
require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Expected coordinate ranges for each county (roughly)
const EXPECTED_COORDS = {
  'Bradford': { lat: [29.8, 30.2], lon: [-82.3, -81.9] },
  'Clay': { lat: [29.9, 30.2], lon: [-81.9, -81.5] },
  'Columbia': { lat: [30.0, 30.5], lon: [-82.8, -82.4] },
  'Duval': { lat: [30.1, 30.5], lon: [-81.9, -81.4] },
  'Nassau': { lat: [30.4, 30.8], lon: [-81.9, -81.4] },
  'Putnam': { lat: [29.4, 29.8], lon: [-82.0, -81.5] },
  'St. Johns': { lat: [29.6, 30.2], lon: [-81.6, -81.2] },
  'Union': { lat: [29.9, 30.2], lon: [-82.5, -82.2] }
};

const SAMPLE_SIZE = 500;
const DATA_ROOT = 'D:\\LandOracle\\Florida';

function findNALFile(countyFolder) {
  // Look for file matching pattern NAL*F202501
  const files = fs.readdirSync(countyFolder);
  const nalFile = files.find(f => f.startsWith('NAL') && f.includes('F202501'));
  
  if (nalFile) {
    return path.join(countyFolder, nalFile);
  }
  return null;
}

async function testCountyCoordinates(countyName) {
  console.log(`\n📍 Testing ${countyName} County...`);
  
  const countyFolder = path.join(DATA_ROOT, countyName);
  
  if (!fs.existsSync(countyFolder)) {
    console.log(`❌ Folder not found: ${countyFolder}`);
    return null;
  }

  // Find the NAL file automatically
  const csvPath = findNALFile(countyFolder);
  
  if (!csvPath) {
    console.log(`❌ NAL file not found in: ${countyFolder}`);
    return null;
  }

  console.log(`   Found: ${path.basename(csvPath)}`);

  const parcels = [];
  
  return new Promise((resolve) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        if (parcels.length < SAMPLE_SIZE) {
          // Extract coordinates (adjust field names if needed)
          const x = parseFloat(row.X_COORD || row.XCOORD);
          const y = parseFloat(row.Y_COORD || row.YCOORD);
          
          if (!isNaN(x) && !isNaN(y)) {
            parcels.push({ x, y });
          }
        }
      })
      .on('end', async () => {
        if (parcels.length === 0) {
          console.log(`❌ No valid coordinates found`);
          resolve(null);
          return;
        }

        console.log(`   Found ${parcels.length} parcels to test`);
        
        // Transform coordinates using PostGIS
        const testResults = [];
        
        for (const parcel of parcels.slice(0, 50)) { // Test first 50 for speed
          try {
            const result = await pool.query(`
              SELECT 
                ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 2238), 4326)) as lat,
                ST_X(ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 2238), 4326)) as lon
            `, [parcel.x, parcel.y]);
            
            testResults.push({
              lat: result.rows[0].lat,
              lon: result.rows[0].lon
            });
          } catch (err) {
            console.log(`   ⚠️  Transform error: ${err.message}`);
          }
        }

        if (testResults.length === 0) {
          console.log(`❌ Transformation failed`);
          resolve(null);
          return;
        }

        // Calculate statistics
        const lats = testResults.map(r => r.lat);
        const lons = testResults.map(r => r.lon);
        
        const stats = {
          county: countyName,
          count: testResults.length,
          avgLat: (lats.reduce((a, b) => a + b) / lats.length).toFixed(6),
          avgLon: (lons.reduce((a, b) => a + b) / lons.length).toFixed(6),
          minLat: Math.min(...lats).toFixed(6),
          maxLat: Math.max(...lats).toFixed(6),
          minLon: Math.min(...lons).toFixed(6),
          maxLon: Math.max(...lons).toFixed(6)
        };

        // Check if within expected range
        const expected = EXPECTED_COORDS[countyName];
        const latOK = stats.avgLat >= expected.lat[0] && stats.avgLat <= expected.lat[1];
        const lonOK = stats.avgLon >= expected.lon[0] && stats.avgLon <= expected.lon[1];
        
        stats.status = (latOK && lonOK) ? '✅ PASS' : '❌ FAIL';
        
        console.log(`   ${stats.status}`);
        console.log(`   Avg: ${stats.avgLat}, ${stats.avgLon}`);
        console.log(`   Range: Lat [${stats.minLat} to ${stats.maxLat}]`);
        console.log(`   Range: Lon [${stats.minLon} to ${stats.maxLon}]`);
        
        if (!latOK || !lonOK) {
          console.log(`   ⚠️  Outside expected range!`);
          console.log(`   Expected: Lat [${expected.lat[0]} to ${expected.lat[1]}], Lon [${expected.lon[0]} to ${expected.lon[1]}]`);
        }

        resolve(stats);
      });
  });
}

async function runTests() {
  console.log('🧪 Testing County Coordinate Accuracy\n');
  console.log(`📁 Data Location: ${DATA_ROOT}\n`);
  console.log('Using EPSG:2238 (Florida North State Plane)\n');
  
  const counties = [
    'Bradford',
    'Clay', 
    'Columbia',
    'Duval',
    'Nassau',
    'Putnam',
    'St. Johns',
    'Union'
  ];

  const results = [];
  
  for (const county of counties) {
    const result = await testCountyCoordinates(county);
    if (result) results.push(result);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  results.forEach(r => {
    console.log(`${r.status} ${r.county.padEnd(12)} - Lat: ${r.avgLat}, Lon: ${r.avgLon}`);
  });
  
  const passed = results.filter(r => r.status.includes('✅')).length;
  const failed = results.filter(r => r.status.includes('❌')).length;
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All counties verified! Safe to do full load.');
  } else {
    console.log('\n⚠️  Some counties failed - check EPSG codes before full load!');
  }

  await pool.end();
}

runTests().catch(console.error);