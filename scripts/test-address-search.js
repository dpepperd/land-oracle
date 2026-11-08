const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/test-address-search.js

const postData = JSON.stringify({
  address: 'Main', // Common street name
  limit: 5
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/parcels/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Cookie': 'test-cookie=1'
  }
};

console.log('Testing Address Search API...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
        const json = JSON.parse(data);
        if (json.error) {
            console.log('Error:', json.error);
        } else {
            console.log(`Found ${json.count} records matching "Main"`);
            if (json.list && json.list.length > 0) {
                const first = json.list[0];
                console.log('First match:', {
                    id: first.parcel_id,
                    phy: first.property_address,
                    own: first.owner_address
                });
            }
        }
    } catch(e) {
        console.log('Response (Non-JSON):', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
});

req.write(postData);
req.end();
