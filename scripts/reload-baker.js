// scripts/reload-baker.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const shapefile = require('shapefile');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getCentroid(geometry) {
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

async function main() {
  console.log('🗑️  Clearing existing Baker data...');
  await pool.query('DELETE FROM parcels WHERE county = $1;', ['Baker']);
  console.log('✅ Cleared\n');
  
  console.log('📂 Loading Baker County...');
  
  const shpPath = 'D:/LandOracle/Florida/Baker/gis/baker_2025Ppar.shp';
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  let skipped = 0;
  const client = await pool.connect();
  
  try {
    const batch = [];
    const BATCH_SIZE = 500;
    
    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      const props = result.value.properties;
      const geom = result.value.geometry;
      
      // Skip parcels without parcel_id
      if (!props.PARCEL_ID) {
        skipped++;
        continue;
      }
      
      const { lat, lon } = getCentroid(geom);
      
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
    
    // Insert remaining
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
    
    console.log(`\r✅ Loaded ${count} parcels (skipped ${skipped} without parcel IDs)`);
    
  } finally {
    client.release();
  }
  
  // Verify final count
  const result = await pool.query('SELECT COUNT(*) as total FROM parcels WHERE county = $1;', ['Baker']);
  console.log(`\n📊 Final count in database: ${result.rows[0].total} Baker County parcels`);
  
  await pool.end();
}

main().catch(console.error);