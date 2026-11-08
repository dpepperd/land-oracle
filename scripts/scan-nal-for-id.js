
const fs = require('fs');
const readline = require('readline');

const nalPath = "D:/LandOracle/Florida/Seminole/NAL69F202501.csv";

async function scan() {
  const fileStream = fs.createReadStream(nalPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    // Simple CSV parser
    const row = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g).map(s => s.replace(/^,/, '').replace(/^"|"$/g, ''));
    
    if (lineCount === 1) {
      headers = row;
      console.log("ALL Headers:", headers);
      console.log("ALT_KEY Index:", headers.indexOf('ALT_KEY'));
      continue;
    }

    if (lineCount <= 6) {
        const altIndex = headers.indexOf('ALT_KEY');
        const parcelIndex = headers.indexOf('PARCEL_ID');
        const altKey = altIndex !== -1 ? row[altIndex] : 'NOT_FOUND';
        const parcelId = parcelIndex !== -1 ? row[parcelIndex] : 'NOT_FOUND';
        
        console.log(`Row ${lineCount}: PARCEL_ID=${parcelId}, ALT_KEY=${altKey}`);
    } else {
        process.exit(0);
    }
  }
}

scan();
