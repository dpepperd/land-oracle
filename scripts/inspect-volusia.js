
const shapefile = require('shapefile');
const path = require('path');

const shpPath = "D:/LandOracle/Florida/Volusia/extracted/Parcel_Ownership.shp";
const dbfPath = "D:/LandOracle/Florida/Volusia/extracted/Parcel_Ownership.dbf";

async function inspect() {
  try {
    const source = await shapefile.open(shpPath, dbfPath);
    const first = await source.read();
    if (first.done) {
      console.log("Empty shapefile");
      return;
    }
    console.log("Create keys:", Object.keys(first.value.properties));
    console.log("Sample values:", first.value.properties);
  } catch (err) {
    console.error("Error:", err);
  }
}

inspect();
