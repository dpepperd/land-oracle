const shapefile = require('shapefile');
const path = require('path');

const SHP_PATH = 'D:\\LandOracle\\Florida\\Levy\\gis\\levy_2025par.shp';

async function analyze() {
    console.log(`🧐 Analyzing Gap for Levy...`);
    console.log(`📂 Source: ${SHP_PATH}`);

    let total = 0;
    let missingId = 0;
    let duplicates = 0;
    let knownNonParcels = 0;
    
    const seenIds = new Set();
    const nonParcelKeywords = ['COUNTY', 'STATE', 'USA', 'WATER', 'ROAD', 'R/W', 'RIGHT OF WAY'];

    try {
        const source = await shapefile.open(SHP_PATH);
        
        while (true) {
            const result = await source.read();
            if (result.done) break;
            total++;
            
            const p = result.value.properties;
            const parcelId = p.PARCELNO;
            const owner = (p.OWN_NAME || '').toUpperCase();

            // 1. Missing ID
            if (!parcelId) {
                missingId++;
                // Check if it's a known non-parcel type
                if (nonParcelKeywords.some(k => owner.includes(k))) {
                    knownNonParcels++;
                }
                continue; // Don't count as duplicate if it doesn't exist
            }

            // 2. Duplicates
            if (seenIds.has(parcelId)) {
                duplicates++;
            } else {
                seenIds.add(parcelId);
            }
        }

        console.log('\n📊 Analysis Results:');
        console.log(`Total Records in SHP:   ${total.toLocaleString()}`);
        console.log(`Records with ID:        ${seenIds.size.toLocaleString()}`);
        console.log(`--------------------------------`);
        console.log(`❌ Missing Parcel ID:    ${missingId.toLocaleString()} (Likely Skipped)`);
        console.log(`   ↳ Of which are ROW/Gov: ${knownNonParcels.toLocaleString()}`);
        console.log(`🔁 Duplicates (Merged):  ${duplicates.toLocaleString()}`);
        console.log(`--------------------------------`);
        console.log(`📉 Explainable Gap:      ${(missingId + duplicates).toLocaleString()}`);
        
    } catch (err) {
        console.error(err);
    }
}

analyze();
