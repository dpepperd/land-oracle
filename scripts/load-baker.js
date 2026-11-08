// scripts/load-baker.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const fs = require('fs');
const shapefile = require('shapefile');
const { Pool } = require('pg');
const proj4 = require('proj4');

// Define projections
// EPSG:2236 - NAD83 / Florida North (ftUS) - Used for Baker, Duval
// EPSG:4326 - WGS84 (Lat/Lon) - Used for Web Maps
proj4.defs('EPSG:2236', '+proj=tmerc +lat_0=29 +lon_0=-84.5 +k=0.9999411764705882 +x_0=609601.2192024384 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_DIR = 'D:/LandOracle/Florida';

async function findShapefile(countyFolder) {
  const gisFolder = path.join(countyFolder, 'gis');
  
  if (fs.existsSync(gisFolder)) {
    const files = fs.readdirSync(gisFolder);
    const shpFile = files.find(f => f.endsWith('.shp'));
    if (shpFile) return path.join(gisFolder, shpFile);
  }
  
  if (fs.existsSync(countyFolder)) {
    const files = fs.readdirSync(countyFolder);
    const shpFile = files.find(f => f.endsWith('.shp'));
    if (shpFile) return path.join(countyFolder, shpFile);
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
    return geom; // Fallback to original if transform fails
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

async function loadBaker() {
  const countyName = 'Baker';
  const countyFolder = path.join(BASE_DIR, countyName);
  const shpPath = await findShapefile(countyFolder);
  
  if (!shpPath) {
    console.log(`❌ No shapefile found for ${countyName}`);
    return 0;
  }
  
  console.log(`\n📂 Loading ${countyName} from ${shpPath}...`);
  
  console.log(`\n📂 Loading ${countyName} from ${shpPath}...`);

  const client = await pool.connect();
  
  // Clear existing Baker data
  try {
      console.log(`🧹 Clearing existing ${countyName} records...`);
      await client.query('DELETE FROM parcels WHERE county = $1', [countyName]);
  } catch (err) {
      console.error('Error clearing data:', err);
      client.release();
      return;
  }
  
  let count = 0;
  
  try {
    const source = await shapefile.open(shpPath);
    const batch = [];
    const BATCH_SIZE = 500;
    
    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      const feature = result.value;
      const props = feature.properties;
      const geomRaw = feature.geometry;
      
      // Transform geometry to WGS84
      const geom = transformGeometry(geomRaw);
      
      // Calculate centroid from new WGS84 geometry
      const { lat, lon } = getCentroid(geom);
      
      const parcelId = props.PARCEL_ID || props.PARCELNO || props.PARCEL || props.PIN || null;
      const ownerName = props.OWNERNAME || props.OWNER_NAME || props.OWNER || null;
      const ownerAddress = props.OWNER_ADDR || props.OWNERADDR || props.ADDRESS || null;
      const ownerCity = props.OWNER_CITY || props.OWNERCITY || props.CITY || null;
      const ownerState = props.OWNER_ST || props.OWNERSTATE || props.STATE || null;
      const ownerZip = props.OWNER_ZIP || props.OWNERZIP || props.ZIP || null;
      const acreage = props.ACRES || props.ACREAGE || props.TOTALACRES || null;
      const landUse = props.LAND_USE || props.LANDUSE || props.USE_CODE || null;
      const assessedValue = props.ASSESSED || props.ASSDVALUE || props.TOTAL_VALUE || null;
      const marketValue = props.MARKET || props.MKTVALUE || props.JUST_VALUE || null;
      
      const outOfState = ownerState && ownerState !== 'FL' && ownerState !== 'Florida';
      
      batch.push([
        countyName, parcelId, ownerName, ownerAddress, ownerCity,
        ownerState, ownerZip, acreage, null, landUse,
        assessedValue, marketValue, lat, lon, JSON.stringify(geom), outOfState
      ]);
      
      // Batch insert every 500 records
      if (batch.length >= BATCH_SIZE) {
        await client.query('BEGIN');
        for (const row of batch) {
          await client.query(`
            INSERT INTO parcels (
              county, parcel_id, owner_name, owner_address, owner_city,
              owner_state, owner_zip, acreage, property_address, land_use,
              assessed_value, market_value, latitude, longitude, geojson, out_of_state
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `, row);
        }
        await client.query('COMMIT');
        count += batch.length;
        batch.length = 0;
        process.stdout.write(`\r   ${count} parcels loaded...`);
      }
    }
    
    // Insert remaining records
    if (batch.length > 0) {
      await client.query('BEGIN');
      for (const row of batch) {
        await client.query(`
          INSERT INTO parcels (
            county, parcel_id, owner_name, owner_address, owner_city,
            owner_state, owner_zip, acreage, property_address, land_use,
            assessed_value, market_value, latitude, longitude, geojson, out_of_state
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, row);
      }
      await client.query('COMMIT');
      count += batch.length;
    }
    
    console.log(`\r✅ Loaded ${count} parcels from ${countyName}`);
    
  } catch (error) {
    console.error(`❌ Error loading ${countyName}:`, error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  
  return count;
}

async function main() {
  console.log('🚀 Loading Baker County only (TEST)...\n');
  
  const count = await loadBaker();
  
  console.log(`\n✅ Complete! Total parcels loaded: ${count.toLocaleString()}`);
  
  // Check database
  const result = await pool.query('SELECT COUNT(*) as total FROM parcels WHERE county = $1;', ['Baker']);
  console.log(`\n📊 Verification: ${result.rows[0].total} Baker County parcels in database`);
  
  await pool.end();
}

main().catch(console.error);