const fs = require('fs');
const readline = require('readline');

const NAL_FILE = 'D:\\LandOracle\\Florida\\Highlands\\NAL38F202501.csv';
const TARGETS = [
    "30372219021800070", // User sample stripped
    "10332804000000320", // Shapefile sample stripped
    "A10332804000000320",
    "30372219021800070C"
];

async function scan() {
    const fileStream = fs.createReadStream(NAL_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let headers = null;

    console.log('--- Scanning NAL ---');

    for await (const line of rl) {
        if (lineCount === 0) {
            headers = line.split(',').map(h => h.trim().replace(/"/g, ''));
            console.log('HEADERS:', headers.join('|'));
        }
        
        // Search
        for (const t of TARGETS) {
            if (line.includes(t)) {
                console.log(`FOUND ${t} at line ${lineCount}: ${line.substring(0, 100)}...`);
            }
        }

        lineCount++;
        if (lineCount > 50000) break; // Scan 50k lines
    }
    console.log(`Scanned ${lineCount} lines.`);
}

scan();
