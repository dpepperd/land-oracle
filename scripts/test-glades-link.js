
const { getPropertyAppraiserUrl } = require('../lib/countyLinks');

// Mock data based on user input
const testId = 'A054131A00002A0000'; // Raw ID
const county = 'Glades';

// Simulate what the frontend does
const url = getPropertyAppraiserUrl(county, testId);

console.log(`County: ${county}`);
console.log(`Input ID: ${testId}`);
console.log(`Generated URL: ${url}`);

const expectedUrl = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=818&LayerID=14562&PageTypeID=4&PageID=6422&KeyValue=A05-41-31-A00-002A-0000';

if (url === expectedUrl) {
    console.log('✅ URL matches expected format!');
} else {
    console.log('❌ URL mismatch!');
    console.log(`Expected: ${expectedUrl}`);
}
