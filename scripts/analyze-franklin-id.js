const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT parcel_id, geojson FROM parcels WHERE county = 'Franklin' LIMIT 5");
        
        console.log("Analyzing Franklin Parcel IDs:");
        for (let r of res.rows) {
            const pid = r.parcel_id;
            const geo = JSON.parse(r.geojson || '{}');
            // Assuming geojson might have props if I stored them? 
            // Wait, I stored geojson geometry only in 'geojson' column usually.
            // But I stored properties in columns.
            // Let's query columns.
        }

        // Query fields to cross reference
        const resDetail = await client.query(`
            SELECT parcel_id, dor_uc, phy_addr1
            FROM parcels 
            WHERE county = 'Franklin' 
            LIMIT 5
        `);
        
        // Function to guess Twn/Rng from Parcel ID
        // DB Format: 2906S02W2093000F0010
        // Decomposition: 29 (Co) 06S (Twn) 02W (Rng) ...
        
        resDetail.rows.forEach(r => {
            const id = r.parcel_id;
            console.log(`Original: ${id}`);
            
            // Attempt parse
            // regex: ^29(\d{2}[NS])(\d{2}[EW])(.*)$
            const match = id.match(/^29(\d{2}[NS])(\d{2}[EW])(.*)$/);
            if (match) {
                const [_, twn, rng, rest] = match;
                console.log(`  Township: ${twn}, Range: ${rng}, Rest: ${rest}`);
                console.log(`  Proposed URL ID: ${rng}${twn}${rest}`);
            } else {
                console.log("  No match for pattern.");
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
run();
