const fs = require('fs');
const csv = require('csv-parser');

const CSV_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\NAL68F202501.csv';
let count = 0;

fs.createReadStream(CSV_FILE)
  .pipe(csv())
  .on('headers', (headers) => {
      console.log('Headers:', headers); // Show ALL headers
      process.exit(0);
  });
