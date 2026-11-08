const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');

const DUVAL_DIR = 'D:/LandOracle/Florida/Duval';
const SHP_PATH = path.join(DUVAL_DIR, 'gis/duval_2025Ppar.shp');
const PRJ_PATH = path.join(DUVAL_DIR, 'gis/duval_2025Ppar.prj');

async function inspect() {
    console.log('--- Inspecting Duval County Data ---');

    console.log('\nReading Shapefile Properties...');
    try {
        const source = await shapefile.open(SHP_PATH);
        const result = await source.read();
        
        if (!result.done) {
            console.log('Sample Feature Properties (First Row):');
            console.log(JSON.stringify(result.value.properties, null, 2));
        }
    } catch (e) {
        console.error('Error reading shapefile:', e);
    }
    if (fs.existsSync(PRJ_PATH)) {
        console.log('PRJ File Content:');
        console.log(fs.readFileSync(PRJ_PATH, 'utf8'));
    } else {
        console.log('PRJ File NOT FOUND');
    }

    // 2. Check Shapefile Attributes
    console.log('\nReading Shapefile Properties...');
    try {
        const source = await shapefile.open(SHP_PATH);
        const result = await source.read();
        
        if (!result.done) {
            console.log('Sample Feature Properties (First Row):');
            console.log(JSON.stringify(result.value.properties, null, 2));
        }
    } catch (e) {
        console.error('Error reading shapefile:', e);
    }
}

inspect();
