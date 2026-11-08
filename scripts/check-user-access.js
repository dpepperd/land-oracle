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
    console.log('🔍 Checking User Access...');
    
    // 1. Get User ID (Assuming single user or specific user, let's list all users)
    const users = await client.query('SELECT id, email, role, subscription_tier FROM users');
    
    for (const u of users.rows) {
        console.log(`User: ${u.email} (${u.role}, ${u.subscription_tier}) [ID: ${u.id}]`);
        
        // 2. Check County Access
        const access = await client.query('SELECT county FROM user_county_access WHERE user_id = $1', [u.id]);
        const counties = access.rows.map(r => r.county);
        console.log(`   - Access: ${counties.join(', ') || 'None'}`);
        
        if (u.role === 'admin') {
            console.log('   - ADMIN: Should have access to ALL.');
        } else {
            if (!counties.includes('Sumter')) {
                console.log('   ⚠️ MISSING SUMTER ACCESS.');
            }
        }
    }

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
