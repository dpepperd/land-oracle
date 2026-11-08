const shapefile = require('shapefile');

async function inspect() {
  const shpPath = 'D:\\LandOracle\\Florida\\Hamilton\\gis\\hamilton_2025Ppar.shp';
  try {
    const source = await shapefile.open(shpPath);
    const first = await source.read();
    
    if (!first.value) return;

    const keys = Object.keys(first.value.properties);
    console.log("All Keys:", keys.join(', '));
    
    const addrKeys = keys.filter(k => k.includes('ADDR') || k.includes('SITUS') || k.includes('LOC'));
    console.log("Potential Address Keys:", addrKeys);

    const props = first.value.properties;
    addrKeys.forEach(k => console.log(`${k}:`, props[k]));

  } catch (e) {
    console.error("Error:", e.message);
  }
}

inspect();
