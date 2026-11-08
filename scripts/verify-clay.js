const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.split('?')[0],
  ssl: { rejectUnauthorized: false }
});

async function verify() {
    console.log('--- Verifying Clay County Data ---');
    try {
        const countRes = await pool.query("SELECT COUNT(*) FROM parcels WHERE county = 'Clay'");
        console.log(`\n📊 Total Clay Records: ${parseInt(countRes.rows[0].count).toLocaleString()}`);

        const res = await pool.query(`
            SELECT parcelno, own_name, ST_AsText(geom) as geom_text, ST_AsGeoJSON(geom) as geojson 
            FROM parcels 
            WHERE county = 'Clay' 
            LIMIT 3
        `);

        if (res.rows.length === 0) {
            console.log('❌ No records found for Clay.');
        } else {
            console.log(`✅ Found ${res.rows.length} records.`);
            res.rows.forEach((row, i) => {
                console.log(`\nRecord ${i+1}:`);
                console.log(`  Parcel: ${row.parcelno}`);
                console.log(`  Owner:  ${row.own_name}`);
                console.log(`  Geom (Text): ${row.geom_text}`);
                
                const g = JSON.parse(row.geojson);
                const coords = g.coordinates[0][0]; // First point of first ring
                console.log(`  Sample Coord: [${coords[0]}, ${coords[1]}]`);
                
                if (Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
                    console.log('  ❌ COORDINATE ERROR: Values are outside WGS84 bounds. Likely State Plane feet.');
                } else {
                    console.log('  ✅ Coordinates look like valid Lat/Lon.');
                }
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

verify();
