const fs = require('fs');
const csv = require('csv-parser');
const shapefile = require('shapefile');

const CSV_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\NAL68F202501.csv';
const SHP_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\gis\\sarasota_2025par.shp';

async function debug() {
    console.log('--- CSV DEBUG ---');
    let csvCount = 0;
    fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (row) => {
            if (csvCount < 3) {
                console.log(`Row ${csvCount}:`, JSON.stringify(row, null, 2));
                // Log headers on first row
                if (csvCount === 0) console.log('CSV Headers:', Object.keys(row));
            }
            csvCount++;
        })
        .on('end', () => {
             console.log('CSV Read Complete. Total Rows (Scan):', csvCount);
             checkShapefile();
        });
}

async function checkShapefile() {
    console.log('\n--- SHAPEFILE DEBUG ---');
    try {
        const source = await shapefile.open(SHP_FILE);
        const first = await source.read();
        console.log('First Feature Properties:', first.value.properties);
        
        let shpCount = 0;
        let reader = source; // already open
        // Just read a few more
        while (shpCount < 3) {
             const res = await source.read();
             if (res.done) break;
             console.log(`Shape ${shpCount+1}:`, res.value.properties);
             shpCount++;
        }
    } catch (e) {
        console.error('Shapefile Error:', e);
    }
}

debug();
