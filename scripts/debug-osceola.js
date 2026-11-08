const shapefile = require('shapefile');
const sourcePath = 'D:/LandOracle/Florida/Osceola/gis/parcels.shp'; 
// Assuming name is 'parcels.shp' or similar, I should list dir first.
// Actually, I'll list the GIS dir first.

const fs = require('fs');
const path = require('path');

const gisDir = 'D:/LandOracle/Florida/Osceola/gis';
if (fs.existsSync(gisDir)) {
    const files = fs.readdirSync(gisDir);
    const shpFile = files.find(f => f.endsWith('.shp'));
    if (shpFile) {
        shapefile.open(path.join(gisDir, shpFile)).then(source => source.read().then(result => {
             console.log("Osceola Props:", result.value.properties);
        })).catch(console.error);
    } else {
        console.log("No shapefile found");
    }
}
