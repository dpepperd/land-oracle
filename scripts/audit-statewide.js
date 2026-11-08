const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

const FLORIDA_DIR = 'D:\\LandOracle\\Florida';

// Helper to find the .dbf file in a county directory
function findDbf(countyDir) {
    if (!fs.existsSync(countyDir)) return null;
    
    // Look in 'gis' or 'GIS' folder first
    let searchDirs = [countyDir, path.join(countyDir, 'gis'), path.join(countyDir, 'GIS')];
    
    for (const d of searchDirs) {
        if (fs.existsSync(d) && fs.lstatSync(d).isDirectory()) {
            const files = fs.readdirSync(d);
            const dbf = files.find(f => f.toLowerCase().endsWith('.dbf') && !f.startsWith('.'));
            if (dbf) return path.join(d, dbf);
        }
    }
    return null;
}

// Read record count from DBF header (Bytes 4-7, Little Endian)
function getDbfRecordCount(dbfPath) {
    try {
        const buffer = Buffer.alloc(8);
        const fd = fs.openSync(dbfPath, 'r');
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        
        const count = buffer.readUInt32LE(4);
        return count;
    } catch (e) {
        return -1; // Error
    }
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('📊 Starting Statewide Data Audit...');
        
        // 1. Get DB Counts
        console.log('Fetching Database Counts...');
        const dbRes = await client.query('SELECT county, COUNT(*) as cnt FROM parcels GROUP BY county');
        const dbCounts = {};
        dbRes.rows.forEach(r => {
            dbCounts[r.county.toLowerCase()] = parseInt(r.cnt, 10);
        });

        // 2. Scan Directories
        const counties = fs.readdirSync(FLORIDA_DIR).filter(f => fs.lstatSync(path.join(FLORIDA_DIR, f)).isDirectory());
        
        console.log(`\nFound ${counties.length} County Directories.`);
        console.log('-'.repeat(80));
        console.log(
            'County'.padEnd(20) + 
            'Shapefile (Est)'.padEnd(20) + 
            'Database'.padEnd(15) + 
            'Delta'.padEnd(15) + 
            'Status'
        );
        console.log('-'.repeat(80));

        const results = [];

        for (const county of counties) {
            const dbfPath = findDbf(path.join(FLORIDA_DIR, county));
            let shpCount = 0;
            
            if (dbfPath) {
                shpCount = getDbfRecordCount(dbfPath);
            }

            const dbCount = dbCounts[county.toLowerCase()] || 0;
            const delta = shpCount - dbCount;
            let status = '✅ OK';

            if (!dbfPath) {
                status = '❌ No Shapefile';
            } else if (dbCount === 0) {
                status = '❌ Not Loaded';
            } else if (delta > (shpCount * 0.05)) { // >5% missing
                status = '⚠️ Partial Load';
            } else if (delta < -100) {
                status = '❓ DB > Shp'; // Duplicates?
            }

            console.log(
                county.padEnd(20) + 
                (dbfPath ? shpCount.toLocaleString() : 'N/A').padEnd(20) + 
                dbCount.toLocaleString().padEnd(15) + 
                (dbfPath ? delta.toLocaleString() : '-').padEnd(15) + 
                status
            );

            results.push({ county, shpCount, dbCount, delta, status });
        }

        fs.writeFileSync('audit_report.json', JSON.stringify(results, null, 2));
        console.log('✅ Audit Report saved to audit_report.json');
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
