const shapefile = require('shapefile');
const fs = require('fs');

async function inspect() {
  const shpPath = 'D:\\LandOracle\\Florida\\Hernando\\gis\\hernando_2025Ppar.shp';
  
  console.log('🔍 Inspecting Hernando Shapefile...');
  const source = await shapefile.open(shpPath);
  
  // Read first 5 records
  for (let i = 0; i < 5; i++) {
    const result = await source.read();
    if (result.done) break;
    
    console.log(`\n--- Record ${i+1} ---`);
    console.log('Attributes:', JSON.stringify(result.value.properties, null, 2));
    
    // Check for geometry type
    const geom = result.value.geometry;
    console.log('Geometry Type:', geom ? geom.type : 'NULL');
    if (geom && geom.coordinates) {
        // Show first coordinate to guess projection
        console.log('Sample Coord:', JSON.stringify(geom.coordinates[0][0]));
    }
  }
}
inspect();
