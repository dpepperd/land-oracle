const shapefile = require('shapefile');

async function run() {
  const shpPath = 'D:\\LandOracle\\Florida\\Citrus\\gis\\citrus_2025Ppar.shp';
  const source = await shapefile.open(shpPath);
  
  console.log('🔍 Searching for 17E18S01... and 000G0...');
  
  let count = 0;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    count++;
    
    const p = result.value.properties;
    const pid = p.PARCELNO || '';
    
    // Fuzzy match parts of user input: "17E18S010010 000G0 0120"
    // Clean spaces to compare
    const cleanPid = pid.replace(/\s/g, '');
    const userClean = '17E18S010010000G00120';
    
    if (cleanPid.includes(userClean) || cleanPid === userClean) {
        console.log('✅ FOUND MATCH!');
        console.log('Exact Shapefile Value:', `"${pid}"`); // quotes to see spaces
        console.log('Alt Key:', p.ALT_KEY);
        console.log('Full Props:', JSON.stringify(p, null, 2));
        break;
    }
    
    // Also try searching for the one I loaded before: 17E19S36 4D000 0290
    if (pid.includes('17E19S36') && pid.includes('4D000') && pid.includes('0290')) {
        // Just to re-confirm what THAT one looks like
        // console.log('Reference Loaded Parcel:', `"${pid}"`);
    }

    if (count % 50000 === 0) console.log(`${count}...`);
  }
}
run();
