const shapefile = require('shapefile');

async function inspect() {
    const shpPath = 'D:\\LandOracle\\Florida\\Wakulla\\gis\\wakulla_2025par.shp';
    console.log('Inspecting:', shpPath);

    try {
        const source = await shapefile.open(shpPath);
        
        let count = 0;
        while(true) {
            const result = await source.read();
            if (result.done || count >= 3) break;
            
            console.log(`\n--- Record ${count + 1} ---`);
            const p = result.value.properties;
            // Log ALL properties to find the formatted one
            Object.keys(p).forEach(k => {
                if (p[k] && String(p[k]).trim() !== '') {
                    console.log(`${k}: ${p[k]}`);
                }
            });
            count++;
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
