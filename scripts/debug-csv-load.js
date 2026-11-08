const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const NAL_FILE = 'D:\\LandOracle\\Florida\\Polk\\NAL63F202501.csv';

console.log('Testing full CSV read...');
let count = 0;

fs.createReadStream(NAL_FILE)
  .pipe(csv())
  .on('data', (row) => {
    count++;
    if (count % 10000 === 0) process.stdout.write(`\rLoaded ${count}...`);
  })
  .on('end', () => {
    console.log(`\nDone. Total rows: ${count}`);
  })
  .on('error', (err) => {
    console.error('\nError reading CSV:', err);
  });
