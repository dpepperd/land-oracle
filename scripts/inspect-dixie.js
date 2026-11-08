const shapefile = require('shapefile');
const fs = require('fs');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Dixie\\gis\\dixie_2025Ppar.shp';
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

        console.log("\n--- Properties (First Record) ---");
        const props = first.value.properties;
        Object.keys(props).forEach(k => {
            console.log(`${k}:`, props[k]);
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
