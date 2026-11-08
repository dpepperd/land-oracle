const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/test-search-api.js

const postData = JSON.stringify({
  counties: ['Lee'], // Test with Lee since we know data exists
  limit: 10
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/parcels/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Cookie': 'test-cookie=1' // Auth might fail if not mocked, but let's see if we get a 401 or 500
  }
};

console.log('Testing Search API...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
        const json = JSON.parse(data);
        if (json.error) {
            console.log('Error:', json.error);
            console.log('Details:', JSON.stringify(json.details, null, 2));
            console.log('Message:', json.message);
        } else {
            console.log('Result Count:', json.count);
            console.log('First Result:', json.list?.[0]?.parcel_id);
        }
    } catch(e) {
        console.log('Response (Non-JSON):', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
});

req.write(postData);
req.end();
