const shapefile = require('shapefile');
const path = require('path');

const SHP_PATH = 'D:\\LandOracle\\Florida\\Saint Johns\\gis\\stjohns_2025par.shp';

async function analyze() {
    console.log(`🧐 Analyzing Gap for St. Johns...`);
    console.log(`📂 Source: ${SHP_PATH}`);

    let total = 0;
    let missingId = 0;
    let duplicates = 0;
    let knownNonParcels = 0;
    
    const seenIds = new Set();
    const nonParcelKeywords = ['COUNTY', 'STATE', 'USA', 'WATER', 'ROAD', 'R/W', 'RIGHT OF WAY', 'HOMEOWNERS ASSOCIATION', 'COMMON AREA'];

    try {
        const source = await shapefile.open(SHP_PATH);
        
        while (true) {
            const result = await source.read();
            if (result.done) break;
            total++;
            
            const p = result.value.properties;
            const parcelId = p.PARCEL_ID || p.PARCELNO || p.PIN || p.RE; // St Johns usually PARCELNO
            const owner = (p.OWN_NAME || '').toUpperCase();

            // 1. Missing ID
            if (!parcelId) {
                missingId++;
                if (nonParcelKeywords.some(k => owner.includes(k))) {
                    knownNonParcels++;
                }
                continue;
            }

            // 2. Duplicates
            if (seenIds.has(parcelId)) {
                duplicates++;
            } else {
                seenIds.add(parcelId);
            }
        }

        console.log('\n📊 Analysis Results (St. Johns):');
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
