const shapefile = require('shapefile');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Escambia\\gis\\escambia_2025Ppar.shp';
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
            console.log("Raw Coords (Sample):", JSON.stringify(first.value.geometry.coordinates).substring(0, 100));
        } else {
            console.log("No Geometry in 1st record");
        }

        console.log("\n--- Keys ---");
        console.log("Keys:", Object.keys(first.value.properties));

        console.log("\n--- First Record Properties ---");
        const props = first.value.properties;
        console.log("PARCELNO:", props.PARCELNO);
        console.log("PARCEL_ID:", props.PARCEL_ID);
        console.log("ALT_KEY:", props.ALT_KEY);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
