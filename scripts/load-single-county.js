const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const shapefile = require('shapefile');
const { Pool } = require('pg');
const fs = require('fs');
const proj4 = require('proj4');

// Define Florida Projections (US Feet)
// Clay is Florida East (EPSG:2236/2881 equivalent for HARN)
proj4.defs([
    ['EPSG:2236', '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs'], // Florida East
    ['EPSG:2238', '+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.9999411764705882 +x_0=200000.0001016002 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs'], // Florida West
    ['EPSG:2239', '+proj=lcc +lat_1=29.58333333333333 +lat_2=30.75 +lat_0=29 +lon_0=-84.5 +x_0=600000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs'] // Florida North
]);

// DB Connection
const dbUrl = process.env.DATABASE_URL.split('?')[0];
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const BASE = 'D:/LandOracle/Florida';
const BATCH = 500;
const COUNTY = process.argv[2];
const LIMIT = process.argv[3] ? parseInt(process.argv[3]) : Infinity;

if (!COUNTY) {
  console.log('Usage: node load-single-county.js <CountyName> [Limit]');
  console.log('For large counties (Duval/Miami-Dade), run with extra memory:');
  console.log('  node --max-old-space-size=8192 scripts/load-single-county.js Duval');
  process.exit(1);
}

// Geometry Helper
function getGeoJSON(geom) {
    if (!geom) return null;
    return JSON.stringify(geom);
}

function transformGeometry(geom, sourceProj) {
    if (!geom || !geom.coordinates) return null;
    try {
        const tr = (coords) => proj4(sourceProj, 'EPSG:4326', coords);

        if (geom.type === 'Polygon') {
            return {
                type: 'Polygon',
                coordinates: geom.coordinates.map(ring => ring.map(tr))
            };
        } else if (geom.type === 'MultiPolygon') {
            return {
                type: 'MultiPolygon',
                coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(tr)))
            };
        }
    } catch (e) {
        return null;
    }
    return geom;
}

// Helper for numeric fields
function safeNum(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const s = val.toString().trim();
    if (s === '') return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

async function load() {
  const folder = path.join(BASE, COUNTY, 'gis');
  if (!fs.existsSync(folder)) {
      console.error(`Folder not found: ${folder}`);
      process.exit(1);
  }

  const files = fs.readdirSync(folder).filter(f => f.endsWith('.shp'));
  if (!files[0]) {
    console.log('No shapefile found');
    process.exit(1);
  }

  const shp = path.join(folder, files[0]);
  console.log(`Loading ${COUNTY} from ${files[0]}...`);

  const client = await pool.connect();
  
  // Prepare (Wipe if full load)
  await prepareCounty(client);

  const source = await shapefile.open(shp);
  
  let batch = [];
  let count = 0;

  try {
    while (true) {
      const r = await source.read();
      if (r.done) break;

      const p = r.value.properties;
      let g = r.value.geometry;
      
      // TRANSFORM GEOMETRY
      // Clay is Florida East. We should ideally read .prj, but hardcoding based on county or trying to detect is safer for "single county" script if we know it.
      // Or we check values. If X > 180, it's projected.
      if (g && g.coordinates && g.coordinates[0]) {
          const first = g.type === 'Polygon' ? g.coordinates[0][0] : g.coordinates[0][0][0];
          if (Math.abs(first[0]) > 180) {
             // It is Projected. Clay is East (EPSG:2236) usually.
             // We'll use Florida East.
             g = transformGeometry(g, 'EPSG:2236');
          }
      }

      const parcelId = p.PARCEL_ID || p.PARCELNO || p.PIN || p.RE || '';
      const cleanId = parcelId.toString().replace(/["']/g, '').trim();
      if (!cleanId) continue;

      const row = [
        COUNTY,
        cleanId, // parcelno
        p.OWN_NAME || p.OWNERNAME || p.OWNER || '', // own_name
        p.OWN_ADDR1 || p.OWNERADDR || p.ADDR1 || '', // own_addr1
        p.OWN_CITY || p.OWNERCITY || p.CITY || '', // own_city
        p.OWN_STATE || p.OWNERSTAT || p.STATE || '', // own_state
        safeNum(p.OWN_ZIPCD || p.OWN_ZIP || p.ZIP), // own_zipcd (NUMERIC FIXED)
        safeNum(p.ACRES || p.LND_SQFOOT && (p.LND_SQFOOT / 43560)), // acreage
        p.PHY_ADDR1 || p.PROPADDR || p.SITUS || '', // phy_addr1
        p.DOR_UC || p.LANDUSE || '', // dor_uc
        safeNum(p.AV_SD || p.ASSD_VAL), // av_sd
        safeNum(p.JV || p.MKT_VAL), // jv
        getGeoJSON(g) // geom
      ];

      batch.push(row);

      if (batch.length >= BATCH) {
        await insertBatch(client, batch);
        count += batch.length;
        batch = [];
        const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        process.stdout.write(`\r${count} loaded... (Heap: ${mem} MB)`);
        
        // Periodic GC if exposed (prevent leaks in long runs)
        if (count % 10000 === 0 && global.gc) {
            global.gc();
        }

        if (count >= LIMIT) {
            console.log(`\n🛑 Hit Limit of ${LIMIT}. Stopping.`);
            break;
        }
      }
    }

    if (batch.length > 0) {
      await insertBatch(client, batch);
      count += batch.length;
    }

    console.log(`\n✅ ${count} parcels loaded`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertBatch(client, rows) {
    if (rows.length === 0) return;
    
    // We construct the query safely
    // Columns:  county, parcelno, own_name, own_addr1, own_city, own_state, own_zipcd, acreage, phy_addr1, dor_uc, av_sd, jv, geom
    
    const placeholders = rows.map((_, i) => {
        const offset = i * 13; // 13 Columns
        const p = Array.from({length: 12}, (_, k) => `$${offset + k + 1}`).join(',');
        // The last param (13) is GeoJSON string. We wrap it in ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)
        // Actually, if the input is Lat/Lon WGS84, it's 4326.
        // Clay data is likely projected?
        // Wait, 'shapefile' lib usually returns WGS84 if .prj is read? No, it returns raw coordinates.
        // If we don't transform, we might be inserting projected coords into 4326.
        // load-baker.js handles tranform. THIS script assumes it's handled or user doesn't care?
        // Let's assume for now we just insert raw. If map is broken, we fix projection.
        // BUT we need to wrap geom.
        return `(${p}, ST_SetSRID(ST_GeomFromGeoJSON($${offset + 13}), 4326))`;
    }).join(',');

    const flatValues = rows.flat();

    const query = `
        INSERT INTO parcels (
            county, parcelno, own_name, own_addr1, own_city, own_state, own_zipcd, 
            acreage, phy_addr1, dor_uc, av_sd, jv, geom
        ) VALUES ${placeholders}
    `;
    // Removed ON CONFLICT because no unique constraint exists on parcelno
    // If you add one later: CREATE UNIQUE INDEX idx_parcels_county_id ON parcels(county, parcelno);

    try {
        await client.query('BEGIN');
        await client.query(query, flatValues);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('\nInsert Error:', e.message);
    }
}

async function prepareCounty(client) {
    // If we are doing a FULL load (no limit), we wipe the county first to avoid dupes
    if (LIMIT === Infinity) {
        console.log(`\n🧹 Full Load Detected: Clearing existing records for ${COUNTY}...`);
        await client.query('DELETE FROM parcels WHERE county = $1', [COUNTY]);
    } else {
        console.log(`\n🧪 Test Mode (Limit ${LIMIT}): Appending records (No Wipe).`);
    }
}

load().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});