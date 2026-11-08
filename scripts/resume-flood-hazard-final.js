const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const { from: copyFrom } = require('pg-copy-streams');
const csv = require('csv-parser');
const { Readable } = require('stream');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const GPKG_PATH = String.raw`D:\LandOracle\dfirm\dfirm_flood_haz_4326.gpkg`;
const TABLE_NAME = 'flood_hazard';
const GIS_ENV = String.raw`C:\Users\Dirk\miniconda3\envs\gis`;
const BATCH_SIZE = 1000; // Even safer batch size
const OFFSET_ROWS = 558154;

const env = { 
    ...process.env,
    GDAL_DATA: path.join(GIS_ENV, 'Library', 'share', 'gdal'),
    PROJ_LIB: path.join(GIS_ENV, 'Library', 'share', 'proj'),
    PATH: path.join(GIS_ENV, 'Library', 'bin') + ';' + process.env.PATH
};

async function resumeImportFinal() {
    const client = await pool.connect();
    try {
        console.log(`🚑 FINAL RESUME Import via SQL OFFSET ${OFFSET_ROWS}...`);
        
        try {
            await client.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN WKT TEXT`);
            console.log('✅ Added WKT column.');
        } catch (e) {
             // ignore
        }

        console.log('🌊 Spawning ogr2ogr (SQL Mode)...');
        const OGR_EXE = path.join(GIS_ENV, 'Library', 'bin', 'ogr2ogr.exe');
        
        // Use SQL to skip efficiency
        const sql = `SELECT * FROM flood_hazard LIMIT 1000000 OFFSET ${OFFSET_ROWS}`;
        
        const ogr = spawn(OGR_EXE, [
            '-f', 'CSV', 
            '/vsistdout/', 
            GPKG_PATH, 
            '-sql', sql,
            '-lco', 'GEOMETRY=AS_WKT',
            '-nlt', 'MULTIPOLYGON'
        ], { env });

        let batch = [];
        let totalLoaded = 0;
        
        const stream = ogr.stdout.pipe(csv());
        
        for await (const row of stream) {
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
                let s = String(v).replace(/"/g, '""');
                return `"${s}"`;
            });
            batch.push(values.join(',') + '\n');

            if (batch.length >= BATCH_SIZE) {
                await uploadBatch(client, batch);
                totalLoaded += batch.length;
                process.stdout.write(`\r✅ Resumed: Committed +${totalLoaded.toLocaleString()} rows...`);
                batch = [];
                if (global.gc) global.gc(); 
            }
        }

        if (batch.length > 0) {
            await uploadBatch(client, batch);
            totalLoaded += batch.length;
        }

        console.log(`\n🎉 Final Resume Complete! Added: ${totalLoaded.toLocaleString()}`);

        if (totalLoaded > 0) {
            console.log('🔄 Converting NEW WKT to Geometry...');
            // Only update NULL geoms, assuming previous ones are done.
            await client.query(`UPDATE ${TABLE_NAME} SET geom = ST_Multi(ST_GeomFromText(WKT, 4326)) WHERE geom IS NULL`);
        }
        
        console.log('🧹 Cleanup WKT...');
        await client.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN WKT`);
        console.log('✅ Finalization Done.');

    } catch (e) {
        console.error('\n❌ Fatal Error:', e);
    } finally {
        if (client) client.release();
        pool.end();
    }
}

async function uploadBatch(client, lines) {
    return new Promise((resolve, reject) => {
        const stream = client.query(copyFrom(`COPY ${TABLE_NAME} (WKT, dfirm_id, fld_zone, zone_subty, sfha_tf, static_bfe, depth, velocity, v_datum, len_unit, floodplain, risk_level, fhz_label, county) FROM STDIN WITH (FORMAT CSV)`));
        const rs = Readable.from(lines);
        rs.pipe(stream);
        stream.on('error', (err) => {
            console.error("Stream Error:", err);
            reject(err);
        });
        stream.on('finish', resolve);
    });
}

resumeImportFinal();
