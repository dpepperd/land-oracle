// scripts/sample-county.js
const path = require('path');
const fs = require('fs');
const shapefile = require('shapefile');
const proj4 = require('proj4');

// Define projections
// EPSG:2236 - NAD83 / Florida North (ftUS) - Used for Baker, Duval, Nassau, etc.
// EPSG:4326 - WGS84 (Lat/Lon) - Used for Web Maps
proj4.defs('EPSG:2236', '+proj=tmerc +lat_0=29 +lon_0=-84.5 +k=0.9999411764705882 +x_0=609601.2192024384 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs');

const BASE_DIR = 'D:/LandOracle/Florida';

async function findShapefile(countyFolder) {
  if (!fs.existsSync(countyFolder)) return null;

  // Check direct folder
  let files = fs.readdirSync(countyFolder);
  let shpFile = files.find(f => f.endsWith('.shp'));
  if (shpFile) return path.join(countyFolder, shpFile);

  // Check 'gis' subfolder
  const gisFolder = path.join(countyFolder, 'gis');
  if (fs.existsSync(gisFolder)) {
    files = fs.readdirSync(gisFolder);
    shpFile = files.find(f => f.endsWith('.shp'));
    if (shpFile) return path.join(gisFolder, shpFile);
  }
  
  return null;
}

function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;

  try {
    if (geom.type === 'Polygon') {
      return {
        type: 'Polygon',
        coordinates: geom.coordinates.map(ring =>
          ring.map(coord => proj4('EPSG:2236', 'EPSG:4326', coord))
        )
      };
    } else if (geom.type === 'MultiPolygon') {
      return {
        type: 'MultiPolygon',
        coordinates: geom.coordinates.map(polygon =>
          polygon.map(ring =>
            ring.map(coord => proj4('EPSG:2236', 'EPSG:4326', coord))
          )
        )
      };
    }
  } catch (err) {
    console.error('Error transforming geometry:', err.message);
    return geom; 
  }
  return geom;
}

function getCentroid(geometry) {
  if (!geometry || !geometry.coordinates) return { lat: null, lon: null };

  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0];
    const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    const lon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    return { lat, lon };
  } else if (geometry.type === 'MultiPolygon') {
    const firstPolygon = geometry.coordinates[0][0];
    const lat = firstPolygon.reduce((sum, c) => sum + c[1], 0) / firstPolygon.length;
    const lon = firstPolygon.reduce((sum, c) => sum + c[0], 0) / firstPolygon.length;
    return { lat, lon };
  }
  return { lat: null, lon: null };
}

async function sampleCounty(countyName) {
  console.log(`\n🔍 Sampling data for: ${countyName}`);
  
  const countyFolder = path.join(BASE_DIR, countyName);
  const shpPath = await findShapefile(countyFolder);
  
  if (!shpPath) {
    console.error(`❌ No shapefile found in ${countyFolder}`);
    console.log(`   (Expected structure: D:/LandOracle/Florida/${countyName}/gis/*.shp)`);
    return;
  }
  
  console.log(`📂 Found shapefile: ${shpPath}`);
  console.log('---------------------------------------------------');

  try {
    const source = await shapefile.open(shpPath);
    
    // Read first 5 records
    for (let i = 0; i < 5; i++) {
      const result = await source.read();
      if (result.done) break;
      
      const feature = result.value;
      const props = feature.properties;
      const geomRaw = feature.geometry;
      
      // Attempt Transformation
      const geom = transformGeometry(geomRaw);
      const { lat, lon } = getCentroid(geom);
      
      console.log(`\nParcel #${i + 1}:`);
      console.log(`  ID:       ${props.PARCEL_ID || props.PARCELNO || props.PIN || 'N/A'}`);
      console.log(`  Owner:    ${props.OWNERNAME || props.OWNER_NAME || props.OWNER || 'N/A'}`);
      console.log(`  Address:  ${props.OWNER_ADDR || props.ADDRESS || 'N/A'}`);
      console.log(`  Land Use: ${props.LAND_USE || props.USE_CODE || 'N/A'}`);
      console.log(`  Raw Geom Type: ${geomRaw.type}`);
      
      // Verify Centroid
      if (lat && lon && lat > 24 && lat < 31 && lon > -88 && lon < -80) {
         console.log(`  ✅ Location: ${lat.toFixed(5)}, ${lon.toFixed(5)} (Valid Florida Lat/Lon)`);
      } else {
         console.log(`  ❌ Bad Location: ${lat}, ${lon} (Outside Florida or Invalid)`);
         if (geomRaw.coordinates[0][0]) {
             console.log(`     Raw Coords Sample: ${geomRaw.coordinates[0][0]}`);
         }
      }
    }
    
    console.log('\n---------------------------------------------------');
    console.log('✅ Sample Complete. If details look correct, you are ready to load.');

  } catch (error) {
    console.error('❌ Error reading shapefile:', error.message);
  }
}

// Allow running with argument: node scripts/sample-county.js "Duval"
const targetCounty = process.argv[2];
if (targetCounty) {
  sampleCounty(targetCounty);
} else {
  console.log('Usage: node scripts/sample-county.js "CountyName"');
}
