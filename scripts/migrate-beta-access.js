const { Pool } = require('pg');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For dev/migration

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Adding Beta Access Control...');

    // 1. Add beta_access column
    console.log('   - Altering users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS beta_access BOOLEAN DEFAULT FALSE;
    `);

    // 2. Grant Beta Access to specific existing admins
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean); // set ADMIN_EMAILS in .env.local
    console.log(`   - Granting access to: ${admins.join(', ')}`);
    
    await client.query(`
      UPDATE users 
      SET beta_access = TRUE 
      WHERE email = ANY($1)
    `, [admins]);

    console.log('✅ Success! Beta Access column added.');

  } catch (err) {
    console.error('❌ Error migrating DB:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
