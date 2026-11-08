const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const { from: copyFrom } = require('pg-copy-streams');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const GPKG_PATH = String.raw`D:\LandOracle\dfirm\dfirm_flood_haz_4326.gpkg`;
const TABLE_NAME = 'flood_hazard';
const GIS_ENV = String.raw`C:\Users\Dirk\miniconda3\envs\gis`;
const BATCH_SIZE = 2000; // Smaller batch for safety
const SKIP_ROWS = 430000; // Resume point

const env = { 
    ...process.env,
    GDAL_DATA: path.join(GIS_ENV, 'Library', 'share', 'gdal'),
    PROJ_LIB: path.join(GIS_ENV, 'Library', 'share', 'proj'),
    PATH: path.join(GIS_ENV, 'Library', 'bin') + ';' + process.env.PATH
};

async function resumeImport() {
    const client = await pool.connect();
    try {
        console.log(`🚑 RESUMING Import from row ${SKIP_ROWS.toLocaleString()}...`);
        
        // Skip Table Creation (Table exists with 430k rows)

        console.log('🌊 Spawning ogr2ogr (with skip)...');
        const OGR_EXE = path.join(GIS_ENV, 'Library', 'bin', 'ogr2ogr.exe');
        
        const ogr = spawn(OGR_EXE, [
            '-f', 'CSV', 
            '/vsistdout/', 
            GPKG_PATH, 
            'flood_hazard',
            '-lco', 'GEOMETRY=AS_WKT',
            '-nlt', 'MULTIPOLYGON',
            '-skip', String(SKIP_ROWS)
        ], { env });

        let batch = [];
        let totalLoaded = 0;

        const processStream = new Promise((resolve, reject) => {
            ogr.stdout.pipe(csv())
                .on('data', async (row) => {
                    const values = [
                        row.geom,
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
                        let s = String(v).replace(/"/g, '""');
                        return `"${s}"`;
                    });
                    
                    batch.push(values.join(',') + '\n');

                    if (batch.length >= BATCH_SIZE) {
                        ogr.stdout.pause(); 
                        try {
                            await uploadBatch(client, batch);
                            totalLoaded += batch.length;
                            process.stdout.write(`\r✅ Resumed: Committed +${totalLoaded.toLocaleString()} rows...`);
                            batch = [];
                            if (global.gc) global.gc(); // Hint GC if enabled
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

        console.log(`\n🎉 Resume Complete! Added: ${totalLoaded.toLocaleString()}`);

        // Post-processing (Run this now that all data is in)
        console.log('🔄 Converting WKT to Geometry (All Rows)...');
        await client.query(`UPDATE ${TABLE_NAME} SET geom = ST_Multi(ST_GeomFromText(WKT, 4326)) WHERE geom IS NULL`);
        // Note: Update WHERE geom IS NULL to handle just new ones? 
        // Actually, previous run didn't update ANY because it crashed before post-processing.
        // So we need to update ALL.
        // But updating 572k rows in one transaction might blow up temp space?
        // Let's try. It's just pointers update usually.
        // Or we can do it in batches? "UPDATE ... WHERE id IN (subquery)" is hard without ID.
        // Let's do a single UPDATE. 500k is manageable for PostGIS usually.
        
        console.log('🧹 Cleanup WKT...');
        await client.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN WKT`);
        
        console.log('INDEX Creating Spatial Index...');
        await client.query(`CREATE INDEX idx_${TABLE_NAME}_geom ON ${TABLE_NAME} USING GIST (geom)`);
        console.log('✅ Finalization Done.');

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

resumeImport();
