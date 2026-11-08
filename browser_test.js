/**
 * BROWSER CONSOLE TEST SCRIPT
 * 
 * Open browser console (F12) on the Land Oracle dashboard
 * Paste this entire script and press Enter
 * 
 * This will test the spatial search API directly
 */

(async function testSpatialSearch() {
    console.log('🔍 Starting Spatial Search Test...\n');
    
    // Test polygon covering a small area in Baker County, FL
    const testPolygon = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-82.35, 30.25],  // SW corner
                [-82.25, 30.25],  // SE corner  
                [-82.25, 30.35],  // NE corner
                [-82.35, 30.35],  // NW corner
                [-82.35, 30.25]   // Close polygon
            ]]
        },
        properties: {}
    };
    
    const testPayload = {
        counties: ['Baker'],
        landUse: ['001'],  // Single Family
        limit: 1000,
        // Bounding box
        minLat: 30.25,
        maxLat: 30.35,
        minLon: -82.35,
        maxLon: -82.25,
        // Spatial shape
        spatialShape: testPolygon
    };
    
    console.log('📤 Sending test request:');
    console.log('  Payload:', JSON.stringify(testPayload, null, 2));
    
    try {
        const response = await fetch('/api/parcels/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        
        const data = await response.json();
        
        console.log('\n📥 Response received:');
        console.log('  Status:', response.status);
        console.log('  Count:', data.count);
        console.log('  Features:', data.geojson?.features?.length);
        
        if (data.count > 0 && data.list) {
            // Check if results are actually inside the polygon
            console.log('\n🔍 Validating results are inside polygon...');
            
            const minLon = -82.35, maxLon = -82.25;
            const minLat = 30.25, maxLat = 30.35;
            
            let insideCount = 0;
            let outsideCount = 0;
            let outsideExamples = [];
            
            data.list.forEach(parcel => {
                const lon = parseFloat(parcel.longitude);
                const lat = parseFloat(parcel.latitude);
                
                const isInside = lon >= minLon && lon <= maxLon && 
                                 lat >= minLat && lat <= maxLat;
                
                if (isInside) {
                    insideCount++;
                } else {
                    outsideCount++;
                    if (outsideExamples.length < 5) {
                        outsideExamples.push({
                            parcel_id: parcel.parcel_id,
                            lon,
                            lat,
                            county: parcel.county
                        });
                    }
                }
            });
            
            console.log('\n📊 Results Analysis:');
            console.log(`  ✅ Inside bbox: ${insideCount}`);
            console.log(`  ❌ Outside bbox: ${outsideCount}`);
            
            if (outsideCount > 0) {
                console.log('\n⚠️ PROBLEM DETECTED: Parcels outside the search area!');
                console.log('  Examples of outside parcels:', outsideExamples);
                console.log('\n  This confirms the spatial filter is NOT working correctly.');
                console.log('  Check server logs for "[SPATIAL]" debug messages.');
            } else {
                console.log('\n✅ All parcels are within the bounding box!');
                console.log('  The spatial filter appears to be working.');
            }
        } else if (data.count === 0) {
            console.log('\n⚠️ No results returned.');
            console.log('  This could mean:');
            console.log('  1. No parcels exist in that area');
            console.log('  2. Spatial filter is too strict');
            console.log('  3. centroid_geom column is empty');
        }
        
        // Also test without spatialShape to compare
        console.log('\n\n📤 Comparison test WITHOUT spatialShape...');
        
        const comparisonPayload = {
            counties: ['Baker'],
            landUse: ['001'],
            limit: 1000,
            minLat: 30.25,
            maxLat: 30.35,
            minLon: -82.35,
            maxLon: -82.25
            // No spatialShape
        };
        
        const compResponse = await fetch('/api/parcels/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comparisonPayload)
        });
        
        const compData = await compResponse.json();
        
        console.log('📥 Comparison (bbox only):');
        console.log('  Count:', compData.count);
        
        if (data.count === compData.count) {
            console.log('\n⚠️ Same count with and without spatialShape!');
            console.log('  This confirms spatialShape is NOT being applied.');
        } else {
            console.log(`\n✅ Different counts: with shape=${data.count}, bbox only=${compData.count}`);
            console.log('  The spatialShape IS affecting results.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    console.log('\n🏁 Test complete. Check server logs for detailed debugging info.');
})();
