
const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

// Will update path after list_dir
const shpPath = "D:/LandOracle/Florida/Seminole/gis/Parcel_Data.shp"; 

async function inspect() {
  // Find actual file
  const dir = "D:/LandOracle/Florida/Seminole/gis/";
  const files = fs.readdirSync(dir);
  const shpFile = files.find(f => f.endsWith('.shp'));
  
  if (!shpFile) { console.log("No .shp found"); return; }
  
  console.log("Reading:", shpFile);
  const source = await shapefile.open(path.join(dir, shpFile));
  
  const first = await source.read();
  if (first.done) return;
  
  console.log("Keys:", Object.keys(first.value.properties));
  console.log("Sample:", first.value.properties);
}

inspect();
