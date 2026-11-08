const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

console.log('Using connection string:', process.env.DATABASE_URL ? 'Found (Hidden)' : 'MISSING');


const CSV_FILE = 'D:\\LandOracle\\Florida\\Sarasota\\NAL68F202501.csv';
const COUNTY = 'Sarasota';

const connectionString = process.env.DATABASE_URL.replace('?sslmode=require', '');
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log('🔵 Starting Debug Load...');
    
    // Test DB Connection
    try {
        const client = await pool.connect();
        console.log('✅ DB Connected');
        
        let inserted = 0;
        
        const stream = fs.createReadStream(CSV_FILE).pipe(csv());
        
        for await (const row of stream) {
            if (inserted >= 5) break; 
            
            const p = {
                parcelno: row.PARCEL_ID, 
                owner: row.OWN_NAME,
                addr: `${row.PHY_ADDR1 || ''} ${row.PHY_CITY || ''}`,
                city: row.PHY_CITY,
                zip: row.PHY_ZIPCD,
                jv: parseInt(row.JV) || 0,
                acres: parseFloat(row.ACREAGE) || 0,
                dor: row.DOR_UC
            };
            
            console.log(`Inserting ${p.parcelno}...`);
            
            try {
                await client.query(`
                    INSERT INTO parcels (
                        parcel_id, parcelno, file_t, county,
                        own_name, phy_addr1, phy_city, phy_zipcd,
                        jv, acreage, dor_uc, geom
                    ) VALUES (
                        $1, $2, 'R', $3,
                        $4, $5, $6, $7,
                        $8, $9, $10, NULL
                    )
                `, [
                    p.parcelno, p.parcelno, COUNTY,
                    p.owner, p.addr, p.city, p.zip,
                    p.jv, p.acres, p.dor
                ]);
                console.log(`✅ Inserted ${p.parcelno}`);
                inserted++;
            } catch (err) {
                console.error(`❌ Insert Failed for ${p.parcelno}:`, err.message);
            }
        }

        console.log('Done.');
        client.release();
        
    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await pool.end();
    }
}

run();
