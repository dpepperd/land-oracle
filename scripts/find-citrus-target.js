const shapefile = require('shapefile');

async function run() {
  const shpPath = 'D:\\LandOracle\\Florida\\Citrus\\gis\\citrus_2025Ppar.shp';
  const targetAltKey = '2232205';

  console.log(`🔍 Searching for AltKey: ${targetAltKey}`);
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    count++;
    
    const p = result.value.properties;
    if (p.ALT_KEY === targetAltKey) {
        console.log('✅ FOUND IT!');
        console.log('Details:', JSON.stringify(p, null, 2));
        break;
    }
    
    if (count % 100000 === 0) console.log(`Scanned ${count}...`);
  }
}
run();
