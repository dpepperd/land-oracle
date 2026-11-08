const fs = require('fs');
const csv = require('csv-parser');

const FILE = 'D:/LandOracle/Florida/Monroe/NAL54F202501.csv';

fs.createReadStream(FILE)
  .pipe(csv())
  .on('data', (data) => {
    console.log('--- ROW START ---');
    Object.keys(data).forEach(k => {
        if (data[k] && data[k].length > 0) {
            console.log(`${k}: ${data[k]}`);
        }
    });
    process.exit(0);
  });
