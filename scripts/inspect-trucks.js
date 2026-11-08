const shapefile = require('shapefile');

async function run() {
    console.log("Reading 1 record from aadt.shp...");
    const source = await shapefile.open('D:\\LandOracle\\aadt\\aadt.shp');
    const result = await source.read();
    
    if (!result.done) {
        console.log("Properties:", result.value.properties);
    } else {
        console.log("Shapefile is empty?");
    }
}

run();
