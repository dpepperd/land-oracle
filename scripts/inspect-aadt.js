const shapefile = require('shapefile');

async function inspect() {
    console.log('Inspecting AADT Shapefile...');
    const source = await shapefile.open('D:\\LandOracle\\aadt\\aadt.shp');
    const first = await source.read();
    if (!first.done) {
        console.log('Geometry Type:', first.value.geometry.type);
        console.log('Properties:', first.value.properties);
    }
}
inspect();
