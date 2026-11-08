const { Pool } = require('pg');
const path = require('path');
const proj4 = require('proj4');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Definitions
// EPSG:2236 - NAD83 / Florida North (ftUS)
// This is standard for Baker County, FL
proj4.defs("EPSG:2236","+proj=tmerc +lat_0=29 +lon_0=-84.5 +k=0.9999411764705882 +x_0=609601.2192024384 +y_0=0 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

const FROM_PROJ = "EPSG:2236";
const TO_PROJ = "EPSG:4326";

async function reproject() {
  const client = await pool.connect();
  let updatedCount = 0;
  
  try {
    console.log('🚀 Starting GeoJSON reprojection (FL State Plane -> WGS84)...');
    
    // 1. Fetch all parcels for Baker county that have bad data
    // We assume bad data has x coordinate > 1000 (since Lat/Lon is small numbers)
    // Or just all of them.
    const queryCheck = `
      SELECT id, geojson 
      FROM parcels 
      WHERE county = 'Baker' 
      AND geojson IS NOT NULL
    `;
    
    // We'll process in chunks using a cursor if needed, but for 12k rows, fetching all ID+JSON is ~20-50MB. OK for memory.
    // For safer memory, we can use LIMIT/OFFSET or a cursor, but let's try direct fetch first.
    console.log('Fetching parcels...');
    const result = await client.query(queryCheck);
    console.log(`Found ${result.rows.length} parcels to process.`);
    
    // Batch update function
    const batchUpdates = [];
    
    for (const row of result.rows) {
      if (!row.geojson || !row.geojson.coordinates) continue;

      try {
        const geo = row.geojson;
        let modified = false;

        // Recursive function to transform coordinates in place
        const transformCoords = (coords) => {
          // Check if it's a coordinate pair [x, y]
          if (typeof coords[0] === 'number') {
            const [x, y] = coords;
            // Check if it looks like State Plane (x > 180 is a safe bet)
            if (Math.abs(x) > 180) {
              const [lon, lat] = proj4(FROM_PROJ, TO_PROJ, [x, y]);
              coords[0] = lon;
              coords[1] = lat;
              return true;
            }
            return false;
          } else if (Array.isArray(coords)) {
            // Recurse down
            let didChange = false;
            for (const c of coords) {
               if (transformCoords(c)) didChange = true;
            }
            return didChange;
          }
          return false;
        };

        if (transformCoords(geo.coordinates)) {
          // Add to batch
          batchUpdates.push({
            id: row.id,
            geojson: JSON.stringify(geo)
          });
        }
      } catch (e) {
        console.warn(`Error transforming parcel ${row.id}:`, e.message);
      }
      
      // Execute batch every 500 items
      if (batchUpdates.length >= 500) {
        await executeBatch(client, batchUpdates);
        updatedCount += batchUpdates.length;
        process.stdout.write(`\r   Updated ${updatedCount} parcels...`);
        batchUpdates.length = 0;
      }
    }
    
    // Final batch
    if (batchUpdates.length > 0) {
      await executeBatch(client, batchUpdates);
      updatedCount += batchUpdates.length;
    }
    
    console.log(`\n✅ Complete! Updated ${updatedCount} parcels with WGS84 coordinates.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

async function executeBatch(client, batch) {
  if (batch.length === 0) return;
  // We can't easily do a single INSERT for UPDATEs. 
  // We'll update one by one in a transaction for safety.
  // Or sending multiple commands.
  
  await client.query('BEGIN');
  for (const item of batch) {
    await client.query('UPDATE parcels SET geojson = $1 WHERE id = $2', [item.geojson, item.id]);
  }
  await client.query('COMMIT');
}

reproject();
