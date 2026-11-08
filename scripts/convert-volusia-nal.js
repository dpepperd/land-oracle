
const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns'); // Assuming date-fns might be available, otherwise use native

const sourcePath = "D:/LandOracle/Florida/Volusia/gis/Parcel_Ownership.shp";
const outputPath = "D:/LandOracle/Florida/Volusia/NAL_Volusia_Generated.csv";

// Helper to escape CSV fields
const esc = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str}"`;
    }
    return str;
};

// NAL Standard Headers (Subset needed for app)
const HEADERS = [
    'PARCEL_ID', 
    'DOR_UC',
    'OWNER_NA', 'OWNER_ADDR_1', 'OWNER_ADDR_2', 'OWNER_CITY', 'OWNER_STATE', 'OWNER_ZIP',
    'PHY_ADDR1', 'PHY_CITY', 'PHY_ZIP',
    'JV', 'LND_VAL', 
    'LND_SQFOOT', 'TOT_LVG_AREA', 'ACT_YR_BLT',
    'SALE_PRC1', 'SALE_YR1',
    'LEGAL1'
];

async function convert() {
    console.log(`Starting conversion: ${sourcePath} -> ${outputPath}`);
    const writeStream = fs.createWriteStream(outputPath);
    
    // Write Header
    writeStream.write(HEADERS.join(',') + '\n');

    let count = 0;
    try {
        const source = await shapefile.open(sourcePath);
        
        while (true) {
            const result = await source.read();
            if (result.done) break;
            
            const p = result.value.properties;
            
            // MAPPING LOGIC
            // PARCEL_ID: 'PARID' (AltKey - e.g. 2000007) for URL compatibility
            const row = {
                PARCEL_ID: p.PARID,
                DOR_UC: p.CLASS ? String(p.CLASS).padStart(3, '0') : null,
                OWNER_NA: p.OWNER1,
                OWNER_ADDR_1: p.MAILADDR1,
                OWNER_ADDR_2: p.MAILADDR2, // often PO Box
                OWNER_CITY: p.MAILCITY,
                OWNER_STATE: p.MAILSTATE,
                OWNER_ZIP: p.MAILZIP,
                PHY_ADDR1: p.ADDRFULL,
                PHY_CITY: p.CITYNAME,
                PHY_ZIP: p.ZIP1,
                JV: p.TOTJUST,
                LND_VAL: p.LANDJUST,
                LND_SQFOOT: p.LANDSQFT, // 142006
                TOT_LVG_AREA: p.RES_TOTAL_ || p.COM_TOTALA || 0, // Try RES then COM
                ACT_YR_BLT: p.RES_MAX_ST || 0, // 'RES_MAX_ST' might be year? Or maybe missing. Let's verify later.
                SALE_PRC1: p.LASTSALEPR,
                SALE_YR1: p.LASTSALEDT ? new Date(p.LASTSALEDT).getFullYear() : '',
                LEGAL1: p.LEGAL1
            };

            const line = HEADERS.map(h => esc(row[h])).join(',') + '\n';
            writeStream.write(line);
            
            count++;
            if (count % 10000 === 0) process.stdout.write(`\rConverted ${count} records...`);
        }
        
        console.log(`\nDone! Wrote ${count} records to ${outputPath}`);
        
    } catch (err) {
        console.error("\nConversion Error:", err);
    } finally {
        writeStream.end();
    }
}

convert();
