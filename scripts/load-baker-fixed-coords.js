// scripts/load-baker-fixed-coords.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const shapefile = require('shapefile');
const proj4 = require('proj4');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Define NAD83 Florida State Plane North (EPSG:2238) - in US Survey Feet
proj4.defs('EPSG:2238', '+proj=lcc +lat_1=29.58333333333333 +lat_2=30.75 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs');

// WGS84 (standard lat/lon)
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

function getCentroid(geometry) {
  try {
    let statePlaneCoords;
    
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      if (!coords || coords.length === 0) return { lat: null, lon: null };
      const x = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const y = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      statePlaneCoords = [x, y];
    } else if (geometry.type === 'MultiPolygon') {
      if (!geometry.coordinates || geometry.coordinates.length === 0) return { lat: null, lon: null };
      const firstPolygon = geometry.coordinates[0][0];
      if (!firstPolygon || firstPolygon.length === 0) return { lat: null, lon: null };
      const x = firstPolygon.reduce((sum, c) => sum + c[0], 0) / firstPolygon.length;
      const y = firstPolygon.reduce((sum, c) => sum + c[1], 0) / firstPolygon.length;
      statePlaneCoords = [x, y];
    } else {
      return { lat: null, lon: null };
    }
    
    // Convert State Plane to WGS84
    const [lon, lat] = proj4('EPSG:2238', 'EPSG:4326', statePlaneCoords);
    
    return { lat, lon };
  } catch (err) {
    return { lat: null, lon: null };
  }
}

async function main() {
  console.log('🗑️  Clearing Baker data...');
  await pool.query('DELETE FROM parcels WHERE county = $1;', ['Baker']);
  console.log('✅ Cleared\n');
  
  console.log('📂 Loading Baker with coordinate transformation...');
  
  const shpPath = 'D:/LandOracle/Florida/Baker/gis/baker_2025Ppar.shp';
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  let skipped = 0;
  const batch = [];
  const BATCH_SIZE = 500;
  const client = await pool.connect();
  
  try {
    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      const props = result.value.properties;
      const geom = result.value.geometry;
      
      if (!props.PARCEL_ID) {
        skipped++;
        continue;
      }
      
      const { lat, lon } = getCentroid(geom);
      
      // Skip if coordinate transformation failed
      if (!lat || !lon) {
        skipped++;
        continue;
      }
      
      const acreage = props.LND_SQFOOT ? props.LND_SQFOOT / 43560 : null;
      const ownerName = props.OWN_NAME || null;
      const ownerAddress = [props.OWN_ADDR1, props.OWN_ADDR2].filter(Boolean).join(' ').trim() || null;
      const ownerCity = props.OWN_CITY || null;
      const ownerState = props.OWN_STATE_ || null;
      const ownerZip = props.OWN_ZIPCD ? String(props.OWN_ZIPCD) : null;
      const outOfState = ownerState && ownerState !== 'FL';
      
      batch.push([
        'Baker', props.PARCEL_ID, ownerName, ownerAddress, ownerCity,
        ownerState, ownerZip, acreage,
        [props.PHY_ADDR1, props.PHY_ADDR2].filter(Boolean).join(' ').trim() || null,
        props.DOR_UC, props.LND_VAL, props.JV, lat, lon,
        JSON.stringify(geom), outOfState
      ]);
      
      if (batch.length >= BATCH_SIZE) {
        await client.query('BEGIN');
        for (const row of batch) {
          await client.query(`
            INSERT INTO parcels (
              county, parcel_id, owner_name, owner_address, owner_city,
              owner_state, owner_zip, acreage, property_address, land_use,
              assessed_value, market_value, latitude, longitude, geojson, out_of_state
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (parcel_id) DO NOTHING
          `, row);
        }
        await client.query('COMMIT');
        count += batch.length;
        batch.length = 0;
        process.stdout.write(`\r   ${count} parcels loaded, ${skipped} skipped...`);
      }
    }
    
    if (batch.length > 0) {
      await client.query('BEGIN');
      for (const row of batch) {
        await client.query(`
          INSERT INTO parcels (
            county, parcel_id, owner_name, owner_address, owner_city,
            owner_state, owner_zip, acreage, property_address, land_use,
            assessed_value, market_value, latitude, longitude, geojson, out_of_state
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (parcel_id) DO NOTHING
        `, row);
      }
      await client.query('COMMIT');
      count += batch.length;
    }
    
    console.log(`\r✅ Loaded ${count} parcels (skipped ${skipped})`);
    
    // Sample check
    const sample = await pool.query('SELECT latitude, longitude FROM parcels WHERE county = $1 LIMIT 1;', ['Baker']);
    console.log(`\n📍 Sample coordinates: lat=${sample.rows[0].latitude}, lon=${sample.rows[0].longitude}`);
    console.log('   (Should be around lat=30.x, lon=-82.x for Baker County)');
    
  } finally {
    client.release();
  }
  
  const final = await pool.query('SELECT COUNT(*) as total FROM parcels WHERE county = $1;', ['Baker']);
  console.log(`\n📊 Final: ${final.rows[0].total} Baker County parcels`);
  
  await pool.end();
}

main().catch(console.error);