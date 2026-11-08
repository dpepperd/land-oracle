const fs = require('fs');
const shapefile = require('shapefile');
const proj4 = require('proj4');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// node scripts/load-aadt.js

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// EPSG:26917 (NAD83 / UTM zone 17N)
const SOURCE_PROJ = '+proj=utm +zone=17 +ellps=GRS80 +datum=NAD83 +units=m +no_defs';

function transformGeometry(geom) {
  if (!geom || !geom.coordinates) return null;
  try {
    const transform = (coord) => proj4(SOURCE_PROJ, 'EPSG:4326', coord);
    if (geom.type === 'LineString') {
      return { type: 'LineString', coordinates: geom.coordinates.map(transform) };
    } else if (geom.type === 'MultiLineString') {
      return { type: 'MultiLineString', coordinates: geom.coordinates.map(line => line.map(transform)) };
    }
  } catch (err) { return null; }
  return geom;
}

async function run() {
  console.log('🚀 Starting AADT Traffic Data Load...');
  
  const client = await pool.connect();
  
  try {
    // 1. Create Table
    await client.query(`
        DROP TABLE IF EXISTS traffic_stats;
        CREATE TABLE traffic_stats (
            id SERIAL PRIMARY KEY,
            roadway TEXT,
            county TEXT,
            aadt INTEGER,
            truck_aadt INTEGER,
            t_factor FLOAT,
            year INTEGER,
            geom GEOMETRY(LineString, 4326)
        );
        CREATE INDEX IF NOT EXISTS idx_traffic_geom ON traffic_stats USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_traffic_aadt ON traffic_stats (aadt);
    `);
    
    console.log('🧹 Table recreated `traffic_stats`...');

    // 2. Stream Shapefile
    console.log('🔗 Streaming Shapefile (Truck Volume)...');
    const source = await shapefile.open('D:\\LandOracle\\truck_volume\\truck_volume.shp');
    let batch = [];
    const BATCH_SIZE = 1000;
    let count = 0;

    while (true) {
        const result = await source.read();
        if (result.done) break;

        const f = result.value;
        const p = f.properties;
        
        let geom = transformGeometry(f.geometry);
        if (!geom) continue;

        batch.push([
            String(p.ROADWAY || ''),
            String(p.COUNTY || ''),
            parseInt(p.AADT) || 0,
            parseInt(p.TruckAADT) || 0,
            parseFloat(p.TFCTR) || 0,
            parseInt(p.YEAR_) || 0,
            JSON.stringify(geom)
        ]);

        if (batch.length >= BATCH_SIZE) {
            await insertBatch(client, batch);
            count += batch.length;
            batch = [];
            process.stdout.write(`\r   Loaded ${count.toLocaleString()}...`);
        }
    }
    
    if (batch.length > 0) {
        await insertBatch(client, batch);
        count += batch.length;
    }
    
    console.log(`\n✅ Done. Loaded ${count.toLocaleString()} segments.`);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

async function insertBatch(client, rows) {
    if (rows.length === 0) return;
    
    const placeholders = [];
    const values = [];
    let idx = 1;
    
    for (const row of rows) {
        placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, ST_SetSRID(ST_GeomFromGeoJSON($${idx+6}), 4326))`);
        values.push(...row);
        idx += 7;
    }
    
    const query = `
        INSERT INTO traffic_stats (roadway, county, aadt, truck_aadt, t_factor, year, geom)
        VALUES ${placeholders.join(',')}
    `;
    
    await client.query(query, values);
}

run();
