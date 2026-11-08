
const shapefile = require('shapefile');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const shpPath = 'D:/LandOracle/Florida/Lake/gis/lake_2025Ppar.shp';

async function inspect() {
    console.log("Opening shapefile at:", shpPath);
    try {
        const source = await shapefile.open(shpPath);
        const result = await source.read();
        if (!result.done) {
            console.log("FIRST RECORD PROPERTIES:");
            console.log(JSON.stringify(result.value.properties, null, 2));
        }
    } catch (e) {
        console.error("Error reading shapefile:", e);
    }
    
    // Check DB
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
            ssl: { rejectUnauthorized: false }
        });
        const res = await pool.query("SELECT parcel_id, parcelno FROM parcels WHERE county = 'Lake' LIMIT 3");
        console.log("\nDB RECORDS (parcel_id, parcelno):");
        console.table(res.rows);
        pool.end();
    } catch(e) { console.error(e); }
}

inspect();
