const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const client = new Client({
  connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/, ''),
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Check current column types
    console.log('\nChecking current column types...');
    const typeCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parcels' 
      AND column_name IN ('latitude', 'longitude', 'market_value');
    `);
    console.log('Current types:');
    typeCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // 1. Create backup
    console.log('\n1. Creating backup table...');
    await client.query('CREATE TABLE IF NOT EXISTS parcels_backup_manual AS SELECT * FROM parcels;');
    console.log('✓ Backup created: parcels_backup_manual');

    // 2. Convert LATITUDE (if it's text)
    const latType = typeCheck.rows.find(r => r.column_name === 'latitude')?.data_type;
    if (latType === 'double precision' || latType === 'numeric') {
      console.log('\n2. LATITUDE is already numeric - skipping');
    } else {
      console.log('\n2. Converting LATITUDE to DOUBLE PRECISION...');
      await client.query('ALTER TABLE parcels ADD COLUMN latitude_new DOUBLE PRECISION;');
      const latResult = await client.query("UPDATE parcels SET latitude_new = CAST(latitude AS DOUBLE PRECISION) WHERE latitude::text ~ '^-?[0-9]';");
      console.log(`✓ Updated ${latResult.rowCount} rows`);
      await client.query('ALTER TABLE parcels DROP COLUMN latitude;');
      await client.query('ALTER TABLE parcels RENAME COLUMN latitude_new TO latitude;');
      console.log('✓ LATITUDE column converted');
    }

    // 3. Convert LONGITUDE (if it's text)
    const lonType = typeCheck.rows.find(r => r.column_name === 'longitude')?.data_type;
    if (lonType === 'double precision' || lonType === 'numeric') {
      console.log('\n3. LONGITUDE is already numeric - skipping');
    } else {
      console.log('\n3. Converting LONGITUDE to DOUBLE PRECISION...');
      await client.query('ALTER TABLE parcels ADD COLUMN longitude_new DOUBLE PRECISION;');
      const lonResult = await client.query("UPDATE parcels SET longitude_new = CAST(longitude AS DOUBLE PRECISION) WHERE longitude::text ~ '^-?[0-9]';");
      console.log(`✓ Updated ${lonResult.rowCount} rows`);
      await client.query('ALTER TABLE parcels DROP COLUMN longitude;');
      await client.query('ALTER TABLE parcels RENAME COLUMN longitude_new TO longitude;');
      console.log('✓ LONGITUDE column converted');
    }

    // 4. Convert MARKET_VALUE (if it's text)
    const valType = typeCheck.rows.find(r => r.column_name === 'market_value')?.data_type;
    if (valType === 'numeric' || valType === 'double precision') {
      console.log('\n4. MARKET_VALUE is already numeric - skipping');
    } else {
      console.log('\n4. Converting MARKET_VALUE to NUMERIC...');
      await client.query('ALTER TABLE parcels ADD COLUMN market_value_new NUMERIC;');
      const valResult = await client.query("UPDATE parcels SET market_value_new = CAST(REGEXP_REPLACE(CAST(market_value AS TEXT), '[^0-9.]', '', 'g') AS NUMERIC) WHERE market_value IS NOT NULL;");
      console.log(`✓ Updated ${valResult.rowCount} rows`);
      await client.query('ALTER TABLE parcels DROP COLUMN market_value;');
      await client.query('ALTER TABLE parcels RENAME COLUMN market_value_new TO market_value;');
      console.log('✓ MARKET_VALUE column converted');
    }

    console.log('\n✅ Migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await client.end();
  }
}

runMigration();