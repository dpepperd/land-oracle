const fs = require('fs');
const shapefile = require('shapefile');
const path = require('path');

const NAL_FILE = 'D:\\LandOracle\\Florida\\Polk\\NAL63F202501.csv';
const SHP_FILE = 'D:\\LandOracle\\Florida\\Polk\\gis\\polk_2025par.shp';

async function inspect() {
    console.log('--- Inspecting NAL CSV ---');
    const stream = fs.createReadStream(NAL_FILE, { encoding: 'utf8', start: 0, end: 2000 });
    
    stream.on('data', (chunk) => {
        const lines = chunk.split('\n');
        console.log('NAL Headers:', lines[0]);
        console.log('First 3 rows:');
        lines.slice(1, 4).forEach((line, i) => console.log(`Row ${i+1}:`, line));
        stream.destroy();
    });

    console.log('\n--- Inspecting Shapefile ---');
    try {
        const source = await shapefile.open(SHP_FILE);
        const first = await source.read();
        console.log('First Feature Properties:', JSON.stringify(first.value.properties, null, 2));
    } catch (error) {
        console.error('Error reading shapefile:', error);
    }
    console.log('\n--- Searching for STATE_PAR_ Match in NAL ---');
    console.log('\n--- Mapping Headers to Values for Match ---');
    const targetVal = "C63-000-782-6932-1";
    const stream5 = fs.createReadStream(NAL_FILE, { encoding: 'utf8' });
    let headers = null;

    stream5.on('data', (chunk) => {
        const lines = chunk.split('\n');
        
        if (!headers) {
             // Assuming first line is headers
             headers = lines[0].replace(/\r/g, '').split(',').map(h => h.replace(/"/g, ''));
             console.log('Captured Headers:', headers);
        }

        const matchLine = lines.find(l => l.includes(targetVal));
        if (matchLine) {
            // rudimentary CSV parsing (handling quotes is hard, but let's try a simple split if no commas in values, or use a regex)
            // The NAL seems to quote strings. 
            // Quick and dirty regex for CSV:
            const matches = matchLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g); 
            // Actually, simpler: split by comma, but respect quotes? 
            // Let's just output the line and manually count if regex is flaky.
            // Or better, use a simple parser function.
            
            console.log('Raw Match Line:', matchLine);

            // Accessing via simple split might be off if commas in quotes, but let's try to align by index if possible.
            // If we just want to know what the PARCEL_ID is:
            
            console.log('Displaying Row Data (best guess):');
            const values = matchLine.replace(/\r/g, '').split(','); // Naive split
            
            // Try to align
            if (headers && values.length >= headers.length) {
                headers.forEach((h, i) => {
                    console.log(`${h}: ${values[i]}`);
                });
            } else {
                 console.log('Header/Value count mismatch (naive split). Check Raw Line.');
            }
            stream5.destroy();
        }
    });
}
inspect();
