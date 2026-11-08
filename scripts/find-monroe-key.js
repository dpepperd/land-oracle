const fs = require('fs');
const csv = require('csv-parser');

const FILE = 'D:/LandOracle/Florida/Monroe/NAL54F202501.csv';
const TARGET_SEQ = '00572221005600';

fs.createReadStream(FILE)
  .pipe(csv())
  .on('data', (row) => {
    const rawId = row.PARCEL_ID || '';
    const cleanId = rawId.replace(/\s+/g, ''); // Remove spaces
    if (cleanId.includes(TARGET_SEQ)) {
        console.log('FOUND MATCH via PARCEL_ID:');
        console.log(`Raw: '${rawId}'`);
        console.log(`Clean: '${cleanId}'`);
        console.log(JSON.stringify(row, null, 2));
        process.exit(0);
    }
  })
  .on('end', () => {
      console.log('No match found for sequence ' + TARGET_SEQ);
  });
