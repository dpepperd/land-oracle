const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// FORCE bypass SSL check
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Projections
// Source: NAD83 / UTM zone 17N (EPSG:26917)
const EPSG_26917 = '+proj=utm +zone=17 +ellps=GRS80 +datum=NAD83 +units=m +no_defs';
// Target: WGS84 (EPSG:4326)
const EPSG_4326 = '+proj=longlat +datum=WGS84 +no_defs';

const FDOT_DIR = 'C:/Users/Dirk/land-oracle/FDOT_data';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;
  try {
    const transform = (coord) => proj4(EPSG_26917, EPSG_4326, coord);
    
    if (geom.type === 'LineString') {
      return { 
          type: 'LineString', 
          coordinates: geom.coordinates.map(transform) 
      };
    } else if (geom.type === 'MultiLineString') {
      return { 
          type: 'MultiLineString', 
          coordinates: geom.coordinates.map(line => line.map(transform)) 
      };
    }
  } catch (err) {
      console.error(err);
    return null;
  }
  return geom;
}

async function loadShapefile(filename, typeLabel) {
    const shpPath = path.join(FDOT_DIR, filename);
    if (!fs.existsSync(shpPath)) {
        console.error(`File not found: ${shpPath}`);
        return;
    }

    console.log(`\n🛣️  Loading ${typeLabel} from ${filename}...`);
    
    const client = await pool.connect();
    let count = 0;

    try {
        await client.query('BEGIN');
        
        const source = await shapefile.open(shpPath);
        
        while(true) {
            const result = await source.read();
            if (result.done) break;
            
            const feature = result.value;
            const props = feature.properties;
            const name = props.ROADWAY || props.HIGWAY_NAM || props.RD_NAME || 'Unknown';
            
            const transformedGeom = transformGeometry(feature.geometry);
            
            if (transformedGeom) {
                const geojsonStr = JSON.stringify(transformedGeom);
                await client.query(
                    `INSERT INTO highways (name, type, geojson, geom) 
                     VALUES ($1, $2, $3, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)))`,
                    [name, typeLabel, geojsonStr]
                );
                count++;
            }
        }

        await client.query('COMMIT');
        console.log(`✅ Loaded ${count} segments.`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error:', err);
    } finally {
        client.release();
    }
}

async function run() {
    const client = await pool.connect();
    
    // Drop and Recreate Table
    console.log('🚧 Resetting highways table...');
    await client.query('DROP TABLE IF EXISTS highways');
    await client.query(`
      CREATE TABLE highways (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(100),
        geojson TEXT NOT NULL,
        geom geometry(Geometry, 4326)
      );
      CREATE INDEX idx_highways_geom ON highways USING GIST (geom);
    `);
    client.release();

    // Load 'interstates.shp'
    await loadShapefile('interstates.shp', 'Interstate');
    
    // Load 'us_roads.shp'
    await loadShapefile('us_roads.shp', 'US Highway');
    
    pool.end();
}

run();