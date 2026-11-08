const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const { from: copyFrom } = require('pg-copy-streams');
const { Readable } = require('stream');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const GPKG_PATH = String.raw`D:\LandOracle\dfirm\dfirm_flood_haz_4326.gpkg`;
const TABLE_NAME = 'flood_hazard';
const GIS_ENV = String.raw`C:\Users\Dirk\miniconda3\envs\gis`;
const BATCH_SIZE = 5000;

const env = { 
    ...process.env,
    GDAL_DATA: path.join(GIS_ENV, 'Library', 'share', 'gdal'),
    PROJ_LIB: path.join(GIS_ENV, 'Library', 'share', 'proj'),
    PATH: path.join(GIS_ENV, 'Library', 'bin') + ';' + process.env.PATH
};

async function runChunkedCopy() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting CHUNKED COPY Import (CSV Stream)...');
        console.log('🔨 Setting up Table...');
        
        await client.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
        await client.query(`
            CREATE TABLE ${TABLE_NAME} (
                WKT TEXT, 
                dfirm_id TEXT,
                fld_zone TEXT,
                zone_subty TEXT,
                sfha_tf TEXT,
                static_bfe TEXT,
                depth TEXT,
                velocity TEXT,
                v_datum TEXT,
                len_unit TEXT,
                floodplain TEXT,
                risk_level TEXT,
                fhz_label TEXT,
                county TEXT,
                geom Geometry(MultiPolygon, 4326)
            )
        `);

        console.log('🌊 Spawning ogr2ogr...');
        const OGR_EXE = path.join(GIS_ENV, 'Library', 'bin', 'ogr2ogr.exe');
        const ogr = spawn(OGR_EXE, [
            '-f', 'CSV', 
            '/vsistdout/', 
            GPKG_PATH, 
            'flood_hazard',
            '-lco', 'GEOMETRY=AS_WKT',
            '-nlt', 'MULTIPOLYGON'
        ], { env });

        // Use CSV parser to handle quotes/newlines correctly
        let batch = [];
        let totalLoaded = 0;

        const processStream = new Promise((resolve, reject) => {
            ogr.stdout.pipe(csv())
                .on('data', async (row) => {
                    // row is object { geom: '...', DFIRM_ID: '...', ... }
                    // We need to convert back to CSV line for COPY or use parameterized insert?
                    // COPY is faster.
                    // Let's reconstruct CSV line.
                    // Wait, reconstruction is risky if we don't escape properly.
                    // But we can use 'fast-csv' or just a simple CSV stringifier?
                    // Actually, if we use csv-parser we are decoding, then we have to encode back for COPY.
                    // Better: use 'pg' parameterized INSERT if batch size is 5000? 
                    // No, COPY is much faster. 
                    // Let's use a CSV serializer.
                    
                    // Simple serializer since we know the data shape
                    const values = [
                        row.geom, // WKT
                        row.DFIRM_ID,
                        row.FLD_ZONE,
                        row.ZONE_SUBTY,
                        row.SFHA_TF,
                        row.STATIC_BFE,
                        row.DEPTH,
                        row.VELOCITY,
                        row.V_DATUM,
                        row.LEN_UNIT,
                        row.FLOODPLAIN,
                        row.RISK_LEVEL,
                        row.FHZ_LABEL,
                        row.COUNTY
                    ].map(v => {
                        if (v === null || v === undefined) return '';
                        // Escape quotes
                        let s = String(v).replace(/"/g, '""');
                        // Wrap in quotes if needed (or always)
                        return `"${s}"`;
                    });
                    
                    batch.push(values.join(',') + '\n');

                    if (batch.length >= BATCH_SIZE) {
                        // Pause stream!
                        ogr.stdout.pause(); 
                        try {
                            await uploadBatch(client, batch);
                            totalLoaded += batch.length;
                            process.stdout.write(`\r✅ Committed ${totalLoaded.toLocaleString()} rows...`);
                            batch = [];
                        } catch (err) {
                            reject(err);
                        }
                        ogr.stdout.resume();
                    }
                })
                .on('end', async () => {
                     if (batch.length > 0) {
                        try {
                            await uploadBatch(client, batch);
                            totalLoaded += batch.length;
                        } catch (err) {
                            reject(err);
                        }
                     }
                     resolve();
                })
                .on('error', reject);
        });

        await processStream;

        console.log(`\n🎉 Import Complete! Total: ${totalLoaded.toLocaleString()}`);

        // Post-processing
        console.log('🔄 Converting WKT to Geometry...');
        await client.query(`UPDATE ${TABLE_NAME} SET geom = ST_Multi(ST_GeomFromText(WKT, 4326))`);
        await client.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN WKT`);
        
        console.log('INDEX Creating Spatial Index...');
        await client.query(`CREATE INDEX idx_${TABLE_NAME}_geom ON ${TABLE_NAME} USING GIST (geom)`);
        console.log('✅ All Done.');

    } catch (e) {
        console.error('\n❌ Fatal Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

async function uploadBatch(client, lines) {
    return new Promise((resolve, reject) => {
        const stream = client.query(copyFrom(`COPY ${TABLE_NAME} (WKT, dfirm_id, fld_zone, zone_subty, sfha_tf, static_bfe, depth, velocity, v_datum, len_unit, floodplain, risk_level, fhz_label, county) FROM STDIN WITH (FORMAT CSV)`));
        
        const rs = Readable.from(lines);
        rs.pipe(stream);

        stream.on('error', reject);
        stream.on('finish', resolve);
    });
}

runChunkedCopy();
