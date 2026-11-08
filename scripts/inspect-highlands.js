const fs = require('fs');
const shapefile = require('shapefile');
const path = require('path');

const NAL_FILE = 'D:\\LandOracle\\Florida\\Highlands\\NAL38F202501.csv';
const SHP_FILE = 'D:\\LandOracle\\Florida\\Highlands\\gis\\highlands_2025Ppar.shp';

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

    const stream = fs.createReadStream(NAL_FILE, { encoding: 'utf8', start: 0, end: 50000 });
    let printedRows = 0;

    stream.on('data', (chunk) => {
        const lines = chunk.split('\n');
        
        if (printedRows === 0) {
             const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
             console.log('FULL NAL HEADERS:', headers.join(' | '));
             
             console.log('First 5 NAL rows:');
             lines.slice(1, 6).forEach((line, i) => console.log(`Row ${i+1}:`, line));
             printedRows = 5;
        }

        // Search Logic
        // Shapefile ID: A10332804000000320
        // User Sample: 30372219021800070C (Strip C -> 30372219021800070)
        const targets = ["A10332804000000320", "10332804000000320", "30372219021800070"];
        
        targets.forEach(target => {
             if (chunk.includes(target)) {
                 const match = lines.find(l => l.includes(target));
                 if (match) console.log(`FOUND Match for ${target}:`, match);
             }
             // Try without Letter Prefix/Suffix?
             // A10332804000000320 -> 10332804000000320
             // 30372219021800070C -> 30372219021800070
             const stripped = target.replace(/[A-Z]/g, '');
             if (chunk.includes(stripped)) {
                 const match = lines.find(l => l.includes(stripped));
                 if (match) console.log(`FOUND Match for Stripped ${stripped} (Original ${target}):`, match);
             }
        });

        stream.destroy();
    });
}

inspect();
