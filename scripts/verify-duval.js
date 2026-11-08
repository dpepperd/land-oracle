const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.split('?')[0],
  ssl: { rejectUnauthorized: false }
});

async function verify() {
    console.log('--- Verifying Duval County Data ---');
    try {
        const countRes = await pool.query("SELECT COUNT(*) FROM parcels WHERE county = 'Duval'");
        const total = parseInt(countRes.rows[0].count);
        console.log(`\n📊 Total Duval Records: ${total.toLocaleString()}`);

        if (total === 0) {
            console.log('❌ No records found! Did the import run?');
            return;
        }

        const res = await pool.query(`
            SELECT parcelno, own_name, ST_AsText(geom) as geom_text, ST_AsGeoJSON(geom) as geojson 
            FROM parcels 
            WHERE county = 'Duval' 
            ORDER BY RANDOM()
            LIMIT 5
        `);

        res.rows.forEach((row, i) => {
            console.log(`\nRecord ${i+1}:`);
            console.log(`  Parcel: ${row.parcelno}`);
            console.log(`  Owner:  ${row.own_name ? row.own_name.substring(0, 30) : 'NULL'}`);
            
            if (!row.geojson) {
                console.log('  ❌ NO GEOMETRY');
                return;
            }

            const g = JSON.parse(row.geojson);
            let coords = null;
            if (g.type === 'Polygon') coords = g.coordinates[0][0];
            else if (g.type === 'MultiPolygon') coords = g.coordinates[0][0][0];
            else if (g.type === 'Point') coords = g.coordinates;

            if (coords) {
                console.log(`  Sample Coord: [${coords[0]}, ${coords[1]}]`);
                // Duval Bounds: approx -82.0 to -81.3 Lon, 30.1 to 30.6 Lat
                if (coords[0] < -82.1 || coords[0] > -81.2 || coords[1] < 30.0 || coords[1] > 30.7) {
                     console.log('  ⚠️ COORDINATE WARNING: Outside expected Duval bounds slightly?');
                } else {
                     console.log('  ✅ Coordinates inside Duval bounds.');
                }
                
                if (Math.abs(coords[0]) > 180) {
                    console.log('  ❌ FATAL: Coordinate is NOT WGS84 (Projected value detected).');
                }
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

verify();
