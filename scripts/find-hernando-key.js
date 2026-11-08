const shapefile = require('shapefile');

async function findParcel() {
  const shpPath = 'D:\\LandOracle\\Florida\\Hernando\\gis\\hernando_2025Ppar.shp';
  const targetParcel = 'R24 122 21 0880 0140 0050'; // From Screenshot
  
  console.log(`🔎 Searching for Parcel ${targetParcel}...`);
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    
    count++;
    if (count % 50000 === 0) console.log(`Scanned ${count} records...`);

    const p = result.value.properties;
    if (p.PARCELNO === targetParcel) {
        console.log('\n✅ FOUND IT!');
        console.log('ALT_KEY:', p.ALT_KEY);
        console.log('PARCELNO:', p.PARCELNO);
        console.log('OWN_NAME:', p.OWN_NAME);
        // Check if ALT_KEY corresponds to 26171
        // Screenshot URL: ParcelKey=26171
        // Expected ALT_KEY: '00026171' or '26171'
        break;
    }
  }
}
findParcel();
