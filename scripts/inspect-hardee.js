const fs = require('fs');
const shapefile = require('shapefile');
const path = require('path');

const NAL_FILE = 'D:\\LandOracle\\Florida\\Hardee\\NAL35F202501.csv';
const SHP_FILE = 'D:\\LandOracle\\Florida\\Hardee\\gis\\hardee_2025Ppar.shp';

async function inspect() {
    console.log('\n--- Inspecting Shapefile First ---');
    try {
        const source = await shapefile.open(SHP_FILE);
        
        console.log('First 5 Shapefile Records:');
        for (let i = 0; i < 5; i++) {
             const result = await source.read();
             if (result.done) break;
             console.log(`Shp Row ${i+1}:`, JSON.stringify(result.value.properties));
        }
    } catch (error) {
        console.error('Error reading shapefile:', error);
    }

    console.log('\n--- Inspecting NAL CSV ---');
    if (!fs.existsSync(NAL_FILE)) { console.error('NAL file not found'); return; }

    const stream = fs.createReadStream(NAL_FILE, { encoding: 'utf8', start: 0, end: 5000 });
    
    stream.on('data', (chunk) => {
        const lines = chunk.split('\n');
        // Clean headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        console.log('FULL NAL HEADERS (First 20):', headers.slice(0, 20).join(' | '));
        
        console.log('First 5 NAL rows:');
        lines.slice(1, 6).forEach((line, i) => console.log(`Row ${i+1}:`, line));
        
        stream.destroy();
    });
}

inspect();
