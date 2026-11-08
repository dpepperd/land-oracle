const { Pool } = require('pg');
const path = require('path');
const shapefile = require('shapefile');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function debug() {
    const client = await pool.connect();
    try {
        console.log('🕵️‍♂️ Debugging Levy Load...');
        const shpPath = 'D:\\LandOracle\\Florida\\Levy\\gis\\levy_2025par.shp';
        
        // 1. Fetch Existing
        const existingRes = await client.query("SELECT parcel_id FROM parcels WHERE county = 'Levy'");
        const existingIds = new Set(existingRes.rows.map(r => r.parcel_id));
        console.log(`DB has ${existingIds.size} records.`);

        // 2. Read SHP and find FIRST missing
        const source = await shapefile.open(shpPath);
        let examined = 0;
        
        while (true) {
            const result = await source.read();
            if (result.done) break;
            examined++;
            
            const p = result.value.properties;
            const parcelId = p.PARCELNO;
            
            if (!parcelId) continue;
            
            if (!existingIds.has(parcelId)) {
                console.log(`\n❌ Found Missing Record:`);
                console.log(`   ParcelID: "${parcelId}"`);
                console.log(`   Owner:    ${p.OWN_NAME}`);
                console.log(`   Geometry: ${result.value.geometry ? result.value.geometry.type : 'NULL'}`);
                
                // Try manual insert
                console.log('   Attempting manual INSERT of this single record...');
                try {
                    await client.query(`
                        INSERT INTO parcels (county, parcel_id, own_name, geojson)
                        VALUES ('Levy', $1, $2, $3)
                    `, [parcelId, p.OWN_NAME, JSON.stringify(result.value.geometry)]);
                    console.log('   ✅ INSERT SUCESSFUL! (Rolled back for safety)');
                } catch (e) {
                    console.log(`   ❌ INSERT FAILED: ${e.message}`);
                }
                
                // Exit after one
                break;
            }
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await client.query('ROLLBACK'); // Validate logic only
        client.release();
        pool.end();
    }
}

debug();
