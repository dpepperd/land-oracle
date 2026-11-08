const { Pool } = require('pg');
const path = require('path');
// Fix SSL for script execution
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const targetEmail = 'tatjanalovesfhrm@gmail.com';

async function promote() {
    const client = await pool.connect();
    try {
        console.log(`🦸 Promoting ${targetEmail} to Admin/Regional...`);
        const res = await client.query(`
            UPDATE users 
            SET 
                role = 'admin',
                subscription_tier = 'regional' -- Grants access to AI/All Counties
            WHERE email = $1
            RETURNING id, email, role, subscription_tier;
        `, [targetEmail]);

        if (res.rowCount > 0) {
            console.log(`✅ Success! User details updated:`);
            console.log(res.rows[0]);
        } else {
            console.log(`❌ User ${targetEmail} NOT FOUND.`);
            console.log(`   Action Required: She must log in to the app (via Google) at least once so her account is created.`);
            console.log(`   Once she logs in, run this script again.`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

promote();
