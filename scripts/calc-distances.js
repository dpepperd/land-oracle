const { Pool } = require('pg');
const path = require('path');
const turf = require('turf'); // v3 from package.json
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function calcDistances() {
  const client = await pool.connect();
  try {
    console.log('📏 Calculating Distances to Highways...');

    // 1. Fetch all Highways
    console.log('   - Fetching highway geometries...');
    const hwRes = await client.query('SELECT id, geojson FROM highways');
    
    // Parse GeoJSON
    const highways = hwRes.rows.map(row => {
        try {
            return JSON.parse(row.geojson);
        } catch(e) { return null; }
    }).filter(g => g !== null);

    console.log(`     Loaded ${highways.length} highway segments.`);

    // 2. Fetch Parcels (Batch Process)
    // Only fetch those needing update? Or all? Let's do all for now.
    // Streaming would be better for 11k, but paging is easier.
    const BATCH_SIZE = 500;
    let offset = 0;
    let processed = 0;

    while (true) {
        const parRes = await client.query(`
            SELECT id, latitude, longitude 
            FROM parcels 
            WHERE latitude IS NOT NULL 
            ORDER BY id 
            LIMIT $1 OFFSET $2
        `, [BATCH_SIZE, offset]);

        if (parRes.rows.length === 0) break;

        const updates = [];

        for (const parcel of parRes.rows) {
            const point = { 
                type: 'Feature', 
                geometry: { 
                    type: 'Point', 
                    coordinates: [parcel.longitude, parcel.latitude] 
                } 
            };

            let minDist = Infinity;

            for (const hwGeom of highways) {
                // turf v3 pointOnLine returns a point.
                // We need pointToLineDistance? v3 might not have it directly or it's named differently.
                // v3 has 'point-on-line'. Let's check distance to that point.
                
                // Workaround for Turf v3 if exact function missing:
                // Use point-on-line to find nearest point, then measure distance.
                // Actually, v3 pointOnLine takes (LineString, Point).
                
                // Let's use simple Haversine to multiple points? No, too slow.
                // Turf v3 has `turf.pointOnLine(line, point)`.
                
                // Correction: `turf.pointOnLine` might be v5+.
                // In v3, `turf.pointOnLine` returns a feature { properties: { dist: <distance> } } ?
                // Let's rely on standard `turf.distance` to line vertices? No, inaccurate.
                
                // Let's try `turf.pointOnLine`. If it fails, we default to 0.
                
                /* 
                   Wait, turf v3 'point-on-line' module.
                   If not available, we can look at vertices.
                   FDOT lines are detailed. 
                   
                   Alternative: Use raw logic.
                */
               
               // Let's assume we can use `turf.pointOnLine` from the bundle.
               // If strict v3 doesn't have it, we might need a simpler approx.
               // But we installed 'turf' which is usually full suite.
               
               try {
                   // Flatten MultiLineString
                   let lines = [];
                   if (hwGeom.type === 'LineString') lines = [hwGeom];
                   else if (hwGeom.type === 'MultiLineString') {
                       lines = hwGeom.coordinates.map(coords => ({ type: 'LineString', coordinates: coords }));
                   }

                   for (const line of lines) {
                        const snapped = turf.pointOnLine(line, point); 
                        // v3 pointOnLine returns Feature with properties.dist? 
                        // Actually, looking at docs, snapped feature is the point on line.
                        // We then calc distance from original point to snapped point.
                        const dist = turf.distance(point, snapped, 'miles');
                        if (dist < minDist) minDist = dist;
                   }
               } catch (e) {
                   // console.error(e);
               }
            }
            
            if (minDist !== Infinity) {
                updates.push({ id: parcel.id, dist: minDist });
            }
        }

        // Batch Update
        // Doing one-by-one for simplicity or constructing a big query?
        // Big query is better.
        if (updates.length > 0) {
            // Generating a big CASE statement or temp table?
            // Simple loop for now, 11k is small enough.
            for (const up of updates) {
                await client.query('UPDATE parcels SET distance_to_highway = $1 WHERE id = $2', [up.dist, up.id]);
            }
        }

        processed += parRes.rows.length;
        process.stdout.write(`\r   Processed ${processed} parcels...`);
        offset += BATCH_SIZE;
    }

    console.log('\n✅ Distance calculation complete.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

calcDistances();
