const http = require('http');

// node scripts/test-server-health.js

const check = (path, name) => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    console.log(`[${name}] Status: ${res.statusCode}`);
    if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`[${name}] Redirect to: ${res.headers.location}`);
    }
  });

  req.on('error', (e) => {
    console.error(`[${name}] Error:`, e.message);
  });
  
  req.on('timeout', () => {
      req.destroy();
      console.error(`[${name}] Timeout`);
  });

  req.end();
};

console.log('Checking Server Health...');
check('/', 'Root');
check('/api/parcels/search', 'Search API (GET)');
check('/api/user/counties', 'Counties API (GET)');
check('/api/test-pages', 'Pages Router (GET)'); // Should be 405 or 404 or 401
