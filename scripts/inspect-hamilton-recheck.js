const shapefile = require('shapefile');

async function inspect() {
  const shpPath = 'D:\\LandOracle\\Florida\\Hamilton\\gis\\hamilton_2025Ppar.shp';
  console.log('Inspecting:', shpPath);

  try {
    const source = await shapefile.open(shpPath);
    const first = await source.read();
    
    if (!first.value) {
      console.log("Empty shapefile");
      return;
    }

    console.log("--- Geometry Type ---");
    if (first.value.geometry) {
      console.log(first.value.geometry.type);
    } else {
      console.log("No Geometry in 1st record");
    }

    console.log("\n--- Keys ---");
    console.log("Keys:", Object.keys(first.value.properties).join(', '));

    console.log("\n--- First Record Properties ---");
    const props = first.value.properties;
    console.log("PARCELNO:", props.PARCELNO);
    console.log("PARCEL_ID:", props.PARCEL_ID);
    console.log("ALT_KEY:", props.ALT_KEY);
    console.log("SITUS:", props.PHY_ADDR1 || props.SITUS); 
    console.log("OWNER:", props.OWN_NAME);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

inspect();
