const shapefile = require('shapefile');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Calhoun\\gis\\calhoun_2025Ppar.shp';
    try {
        const source = await shapefile.open(shpPath);
        console.log("PARCELNO | SEC | TWN | RNG | OTHERS");
        let count = 0;
        while(true) {
            const r = await source.read();
            if (r.done || count > 10) break;
            const p = r.value.properties;
            console.log(`${p.PARCELNO} | ${p.SEC} | ${p.TWN} | ${p.RNG} | Block:${p.BLOCK || ''} Lot:${p.LOT || ''}`);
            count++;
        }
    } catch (e) {
        console.error(e);
    }
}
inspect();
