const shapefile = require('shapefile');

async function count() {
    const shpPath = 'D:\\LandOracle\\Florida\\Jackson\\gis\\jackson_2025Ppar.shp';
    console.log('Counting records in:', shpPath);
    const source = await shapefile.open(shpPath);
    let n = 0;
    while (true) {
        const result = await source.read();
        if (result.done) break;
        n++;
        if (n % 5000 === 0) console.log(`Counted ${n}...`);
    }
    console.log(`Total Records: ${n}`);
}
count();
