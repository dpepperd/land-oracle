const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// node scripts/check-api-response.js

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/user/counties',
  method: 'GET',
};

// Simple check to ensure we get a 200 OK and data quickly
const start = Date.now();
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const duration = Date.now() - start;
    console.log(`API Status: ${res.statusCode}`);
    console.log(`Duration: ${duration}ms`);
    try {
        const json = JSON.parse(data);
        console.log('Live Counties:', json.liveCounties?.length);
    } catch(e) {
        console.log('Response not JSON:', data.substring(0, 100));
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
  console.log('NOTE: Ensure server is running (npm run dev)');
});

req.end();
