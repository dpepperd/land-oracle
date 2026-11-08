const shapefile = require('shapefile');

async function run() {
  const shpPath = 'D:\\LandOracle\\Florida\\Citrus\\gis\\citrus_2025Ppar.shp';
  
  console.log('🔍 Broad Search Citrus...');
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    count++;
    
    const p = result.value.properties;
    
    // Check Owner
    if (p.OWN_NAME && p.OWN_NAME.includes('SMITH ABBY')) {
        console.log('✅ Found match by OWNER!');
        console.log(JSON.stringify(p, null, 2));
    }
    
    // Check approximate Alt Key (maybe string mismatch?)
    if (p.ALT_KEY && String(p.ALT_KEY).includes('2232205')) {
        console.log('✅ Found match by ALT_KEY fuzzy!');
        console.log(JSON.stringify(p, null, 2));
    }

    // Check Parcel No partial
    if (p.PARCELNO && p.PARCELNO.replace(/\s/g,'').includes('17E19S364D0000290')) {
        console.log('✅ Found match by PARCELNO clean!');
        console.log(JSON.stringify(p, null, 2));
    }
    
    if (count % 50000 === 0) console.log(`Scanned ${count}...`);
  }
}
run();
