const shapefile = require('shapefile');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Leon\\gis\\leon_2025par.shp';
    console.log('Inspecting:', shpPath);

    try {
        const source = await shapefile.open(shpPath);
        
        // Read first 10 records
        let count = 0;
        while(true) {
            const result = await source.read();
            if (result.done || count >= 10) break;
            
            const p = result.value.properties;
            const id = p.PARCELNO; // "2612202170000"
            // Try to find properties that look like "110528  B0140"
            // The user example has 2 spaces.
            
            console.log(`\n--- Record ${count+1} ---`);
            console.log(`PARCELNO: '${id}'`);
            
            // Allow logging other potential ID columns
            ['PARCEL_ID', 'ALT_KEY', 'AK', 'PC', 'NB', 'GEO_ID'].forEach(k => {
                if (p[k]) console.log(`${k}: '${p[k]}'`);
            });

            count++;
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
