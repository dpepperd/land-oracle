const shapefile = require('shapefile');
const path = require('path');

const PASCO_PATH = 'D:\\LandOracle\\Florida\\Pasco';

async function run() {
  const shpPath = path.join(PASCO_PATH, 'gis', 'pasco_2025par.shp');
  console.log(`Inspecting: ${shpPath}`);
  
  const source = await shapefile.open(shpPath);
  const result = await source.read();
  
  if (!result.done) {
      console.log('Fields found in first record:');
      console.log(Object.keys(result.value.properties));
      console.log('Sample Values:', result.value.properties);
  }
}
run();
