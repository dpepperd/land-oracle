const { spawn } = require('child_process');
const path = require('path');

const GIS_ENV = String.raw`C:\Users\Dirk\miniconda3\envs\gis`;
const OGR_EXE = path.join(GIS_ENV, 'Library', 'bin', 'ogr2ogr.exe');
const GPKG_PATH = String.raw`D:\LandOracle\dfirm\dfirm_flood_haz_4326.gpkg`;

const env = { 
    ...process.env,
    GDAL_DATA: path.join(GIS_ENV, 'Library', 'share', 'gdal'),
    PROJ_LIB: path.join(GIS_ENV, 'Library', 'share', 'proj'),
    PATH: path.join(GIS_ENV, 'Library', 'bin') + ';' + process.env.PATH
};

console.log('Spawning ogr2ogr dump inspection...');
const ogr = spawn(OGR_EXE, [
    '-f', 'PGDUMP', 
    '/vsistdout/', 
    GPKG_PATH, 
    'flood_hazard',
    '-lco', 'DROP_TABLE=YES',
    '--config', 'PG_USE_COPY', 'YES',
    '-limit', '5'
], { env });

ogr.stdout.on('data', d => console.log(d.toString()));
ogr.stderr.on('data', d => console.error(d.toString()));
