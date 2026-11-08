
const { getPropertyAppraiserUrl } = require('../lib/countyLinks');

// Test data
const county = 'Hendry';
const testId = '123456'; 

// Expected URL based on newly added config
const expectedUrl = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1105&LayerID=27399&PageTypeID=4&PageID=11143&KeyValue=123456';

const url = getPropertyAppraiserUrl(county, testId);

console.log(`County: ${county}`);
console.log(`Input ID: ${testId}`);
console.log(`Generated URL: ${url}`);

if (url === expectedUrl) {
    console.log('✅ URL matches expected format!');
} else {
    console.log('❌ URL mismatch!');
    console.log(`Expected: ${expectedUrl}`);
}
