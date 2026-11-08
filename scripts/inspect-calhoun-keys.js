const shapefile = require('shapefile');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Calhoun\\gis\\calhoun_2025Ppar.shp';
    try {
        const source = await shapefile.open(shpPath);
        const first = await source.read();
        console.log("Keys:", Object.keys(first.value.properties));
        console.log("PARCELNO:", first.value.properties.PARCELNO);
        console.log("PARCEL_ID:", first.value.properties.PARCEL_ID);
    } catch (e) {
        console.error(e);
    }
}
inspect();
