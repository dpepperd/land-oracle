const fs = require('fs');
const csv = require('csv-parser');

const countyName = 'Collier';
const nalPath = `D:/LandOracle/Florida/${countyName}/NAL11F202502.csv`; // Need to find the exact NAL filename

// Actually, let's auto-find NAL just like load-county.js
function findNAL() {
    const dir = `D:/LandOracle/Florida/${countyName}`;
    const files = fs.readdirSync(dir);
    return dir + '/' + files.find(f => f.startsWith('NAL') && f.endsWith('.csv'));
}

async function check() {
    const file = findNAL();
    const map = new Map();
    
    let total = 0;
    let dupKeys = 0;
    let maxDups = 0;
    
    fs.createReadStream(file)
      .pipe(csv())
      .on('data', row => {
          total++;
          let id = row.PARCEL_ID;
          if (id) {
              id = id.replace(/["']/g, '').trim();
              let joinKey = id.replace(/[^a-zA-Z0-9]/g, '');
              
              if (map.has(joinKey)) {
                  let count = map.get(joinKey) + 1;
                  map.set(joinKey, count);
                  if (count === 2) dupKeys++;
                  if (count > maxDups) maxDups = count;
              } else {
                  map.set(joinKey, 1);
              }
          }
      })
      .on('end', () => {
          console.log(`Total NAL Rows: ${total}`);
          console.log(`Unique Join Keys: ${map.size}`);
          console.log(`Keys with Duplicates: ${dupKeys}`);
          console.log(`Max Duplicates for a single Key: ${maxDups}`);
      });
}

check();
