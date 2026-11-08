const shapefile = require('shapefile');

async function run() {
  const shpPath = 'D:\\LandOracle\\Florida\\Hernando\\gis\\hernando_2025Ppar.shp';
  console.log('Counting Hernando source records...');
  const source = await shapefile.open(shpPath);
  
  let count = 0;
  while (true) {
      const result = await source.read();
      if (result.done) break;
      count++;
      if (count % 20000 === 0) console.log(`${count}...`);
  }
  console.log(`Total Source Records: ${count}`);
}
run();
