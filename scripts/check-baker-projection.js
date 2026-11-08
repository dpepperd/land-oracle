// scripts/check-baker-projection.js
const shapefile = require('shapefile');
const fs = require('fs');

async function checkProjection() {
  // Read the .prj file to see what projection Baker uses
  const prjFile = 'D:/LandOracle/Florida/Baker/gis/baker_2025Ppar.prj';
  
  if (fs.existsSync(prjFile)) {
    const prjText = fs.readFileSync(prjFile, 'utf8');
    console.log('Baker County Projection Info:');
    console.log(prjText);
  } else {
    console.log('No .prj file found');
  }
  
  // Also check a sample coordinate
  const source = await shapefile.open('D:/LandOracle/Florida/Baker/gis/baker_2025Ppar.shp');
  const first = await source.read();
  const geom = first.value.geometry;
  
  console.log('\nSample raw coordinates from shapefile:');
  if (geom.type === 'Polygon') {
    console.log('First point:', geom.coordinates[0][0]);
  }
}

checkProjection();