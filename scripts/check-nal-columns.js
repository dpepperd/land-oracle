// scripts/check-nal-columns.js
const fs = require('fs');
const csv = require('csv-parser');

const testFile = 'D:\\LandOracle\\Florida\\Bradford\\NAL14F202501.csv';

console.log('📋 Checking NAL file columns...\n');
console.log(`File: ${testFile}\n`);

fs.createReadStream(testFile)
  .pipe(csv())
  .on('headers', (headers) => {
    console.log('Column names found:');
    headers.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
    process.exit(0);
  })
  .on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });