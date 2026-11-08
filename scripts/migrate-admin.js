const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Applying Admin & Parcel Updates...');

    await client.query('BEGIN');

    // 1. Users Table: Add Role
    console.log('   - Adding `role` to users...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
    `);

    // 2. Parcels Table: Add Editable Fields
    console.log('   - Adding `phone_number` and `notes` to parcels...');
    await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS phone_number TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    // 3. Set Specific User to Admin
    const adminEmail = 'dpepperd@gmail.com';
    console.log(`   - Promoting ${adminEmail} to Admin...`);
    const res = await client.query(`
        UPDATE users 
        SET role = 'admin' 
        WHERE email = $1
        RETURNING id, email, role;
    `, [adminEmail]);

    if (res.rowCount > 0) {
        console.log(`     ✅ User promoted:`, res.rows[0]);
    } else {
        console.log(`     ⚠️ User ${adminEmail} not found. They might need to sign in first.`);
    }

    await client.query('COMMIT');
    console.log('✅ Migration successful!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
