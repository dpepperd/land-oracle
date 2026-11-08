const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
const targetEmail = args[0] || 'dpepperd@gmail.com';

async function promote() {
    const client = await pool.connect();
    try {
        console.log(`🦸 Promoting ${targetEmail} to Admin...`);
        const res = await client.query(`
            UPDATE users 
            SET role = 'admin' 
            WHERE email = $1
            RETURNING id, email, role;
        `, [targetEmail]);

        if (res.rowCount > 0) {
            console.log(`✅ Success! User ${targetEmail} is now an Admin.`);
            console.log(res.rows[0]);
        } else {
            console.log(`❌ User ${targetEmail} not found.`);
            console.log(`   Please ensure they have signed into the app first.`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

promote();
