const shapefile = require('shapefile');
const sourcePath = 'D:/LandOracle/Florida/Brevard/gis/brevard_2025Ppar.shp';

async function inspect() {
    const source = await shapefile.open(sourcePath);
    const result = await source.read();
    if (!result.done) {
        console.log("Shapefile Props:", JSON.stringify(result.value.properties, null, 2));
    }
}
inspect().catch(console.error);
