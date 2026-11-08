// Native fetch is available in Node.js 18+
async function testApi() {
  console.log("Testing API at http://localhost:3001/api/parcels/search...");
  
  const payload = {
    "counties": ["Baker"],
    "landUse": [],
    "acreageMin": 0,
    "acreageMax": 100,
    "maxDistance": 0,
    "ownerType": "all",
    "parcelId": "",
    "limit": 100,
    // Add a dummy polygon to trigger the spatial path
    "spatialShape": {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-82.3, 30.2], [-82.2, 30.2], [-82.2, 30.3], [-82.3, 30.3], [-82.3, 30.2]
        ]]
      }
    }
  };

  try {
    const res = await fetch('http://localhost:3001/api/parcels/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    
    if (res.status === 200) {
      const data = await res.json();
      console.log(`Success! Got ${data.list?.length || 0} results.`);
    } else {
      const text = await res.text();
      console.log("Response Body:", text);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testApi();
