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
        const res = await client.query("SELECT parcel_id FROM parcels WHERE county = 'Liberty' LIMIT 10");
        
        console.log("Analyzing Liberty Parcel IDs:");
        res.rows.forEach(r => {
            const id = r.parcel_id;
            console.log(`Original: ${id}`);
            
            // Expected Pattern based on user input: 006-1S-5W-00083-024
            // DB has: 0061S5W00083024 (maybe?)
            
            // Regex attempt
            // 3 chars (Sec seems to be 3)
            // 2 chars (Twn seems to be 2 e.g. 1S)
            // 2 chars (Rng seems to be 2 e.g. 5W)
            // 8 chars remaining? 
            
            const match = id.match(/^(\d{3})(.{2})(.{2})(\d{8})$/);
            if (match) {
               const [_, sec, twn, rng, rest] = match;
               // "Rest" likely needs splitting into 5 and 3?
               const block = rest.substring(0, 5);
               const lot = rest.substring(5, 8);
               const formatted = `${sec}-${twn}-${rng}-${block}-${lot}`;
               console.log(`  Formatted: ${formatted}`);
            } else {
                console.log("  No match for 3-2-2-8 pattern.");
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
