
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
});

const TARGET_EMAIL = process.argv[2];

async function main() {
    if (!TARGET_EMAIL) {
        console.log("Usage: node scripts/demote-user.js <email>");
        return;
    }

    try {
        console.log(`\n📉 Demoting user: ${TARGET_EMAIL}`);
        
        // 1. Check if user exists
        const uRes = await pool.query("SELECT id, role, subscription_tier FROM users WHERE email ILIKE $1", [TARGET_EMAIL]);
        if (uRes.rows.length === 0) {
            console.log("❌ User not found.");
            return;
        }
        const user = uRes.rows[0];
        console.log(`Current Status: Role=${user.role}, Tier=${user.subscription_tier}`);
        
        // 2. Demote
        await pool.query("UPDATE users SET role = 'user', subscription_tier = 'scout' WHERE id = $1", [user.id]);
        console.log("✅ User updated to Role='user', Tier='scout'.");

        // 3. Clear existing access (to make them "fresh")
        try {
            await pool.query("DELETE FROM user_county_access WHERE user_id = $1", [user.id]);
            console.log("✅ Cleared any existing county access records.");
        } catch (e) {
            if (e.message.includes('relation "user_county_access" does not exist')) {
                console.log("⚠️ Table 'user_county_access' missing. Creating it...");
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_county_access (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        county VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, county)
                    );
                `);
                console.log("✅ Created 'user_county_access' table.");
            } else {
                console.error("Error clearing access:", e.message);
            }
        }

    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
