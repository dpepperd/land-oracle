const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB');
    
    // Read schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'db-schema.sql'), 'utf8');
    
    // Run Schema
    console.log('Applying Schema...');
    await client.query(schemaSql);
    console.log('Schema Applied.');

    // Seed Sample Data if empty
    const res = await client.query('SELECT COUNT(*) FROM parcels');
    if (parseInt(res.rows[0].count) === 0) {
        console.log('Seeding Sample Data...');
        const samples = Array.from({ length: 50 }).map((_, i) => {
            return `(
                'SEED-${i}', 
                'Duval', 
                'Seed Owner ${i}', 
                '${i} Seed St', 
                'Jacksonville', 
                '${i % 3 === 0 ? 'GA' : 'FL'}', 
                '32202', 
                '${i} Property Ln', 
                ${(Math.random() * 20).toFixed(2)}, 
                50000, 
                40000, 
                'VACANT RESIDENTIAL', 
                ${30.3322 + (Math.random() - 0.5) * 0.1}, 
                ${-81.6557 + (Math.random() - 0.5) * 0.1}, 
                ${i % 3 === 0},  
                '{"type": "Point", "coordinates": [${-81.6557 + (Math.random() - 0.5) * 0.1}, ${30.3322 + (Math.random() - 0.5) * 0.1}]}'
            )`;
        });

        const insertSql = `
            INSERT INTO parcels (
                parcel_id, county, owner_name, owner_address, owner_city, owner_state, owner_zip, 
                property_address, acreage, market_value, assessed_value, land_use, 
                latitude, longitude, out_of_state, geojson
            ) VALUES ${samples.join(',')}
        `;
        await client.query(insertSql);
        console.log('Seeded 50 parcels.');
    } else {
        console.log('Parcels table already has data, skipping seed.');
    }

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Init Error:', err);
    process.exit(1);
  }
}

init();
