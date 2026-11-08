const shapefile = require('shapefile');
const path = require('path');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Levy\\gis\\levy_2025par.shp';
    console.log(`Inspecting ${shpPath}...`);
    
    const source = await shapefile.open(shpPath);
    const result = await source.read();
    
    if (!result.done) {
        console.log('--- First Record Properties ---');
        console.log(JSON.stringify(result.value.properties, null, 2));
        console.log('--- Geometry Type ---');
        console.log(result.value.geometry.type);
    } else {
        console.log('Empty shapefile?');
    }
}

inspect().catch(console.error);
