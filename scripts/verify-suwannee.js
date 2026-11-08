const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log("🔍 Verifying Suwannee Records...");
        const countRes = await client.query("SELECT count(*) FROM parcels WHERE county = 'Suwannee'");
        console.log(`Total Suwannee Records: ${countRes.rows[0].count}`);

        const res = await client.query(`
            SELECT parcel_id, own_name, ST_AsText(geom) as wkt, 
                   ST_Y(ST_Centroid(geom)) as lat, ST_X(ST_Centroid(geom)) as lon
            FROM parcels 
            WHERE county = 'Suwannee' 
            LIMIT 5
        `);
        
        console.log("\nSample Records:");
        res.rows.forEach(r => {
            console.log(`- ID: ${r.parcel_id} | Owner: ${r.own_name}`);
            console.log(`  Lat/Lon: ${r.lat}, ${r.lon}`);
            console.log(`  Geometry Valid: ${r.wkt ? 'YES' : 'NO'}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
run();
