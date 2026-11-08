const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

// Sumter Path
const shpPath = 'D:\\LandOracle\\Florida\\Sumter\\gis\\sumter_2025par.shp';

async function inspect() {
    console.time('Read');
    try {
        const source = await shapefile.open(shpPath, undefined, { encoding: 'utf-8' });
        
        // Read 5 records
        let count = 0;
        let result;
        const dorCounts = {};

        console.log('--- Sample Records ---');
        while (count < 5 && (result = await source.read()) && !result.done) {
            console.log(`Record ${count + 1}:`, JSON.stringify(result.value.properties, null, 2));
            
            // Collect DOR stats for first 100
             const dor = result.value.properties.DOR_UC || 'NULL';
             dorCounts[dor] = (dorCounts[dor] || 0) + 1;
            count++;
        }
        
        // Scan more for DOR stats
        while (count < 100 && (result = await source.read()) && !result.done) {
             const dor = result.value.properties.DOR_UC || 'NULL';
             dorCounts[dor] = (dorCounts[dor] || 0) + 1;
             count++;
        }

        console.log('\n--- DOR_UC Samples ---');
        console.log(dorCounts);

    } catch (error) {
        console.error('Error:', error);
    }
    console.timeEnd('Read');
}

inspect();
