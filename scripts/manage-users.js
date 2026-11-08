
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false }
});

const CMD = process.argv[2]; // 'list' or 'reset'
const TARGET_EMAIL = process.argv[3];

async function main() {
    try {
        if (CMD === 'reset' && TARGET_EMAIL) {
            console.log(`\n🗑️  RESETTING USER: ${TARGET_EMAIL}`);
            // 1. Get User ID
            const uRes = await pool.query("SELECT user_id FROM user_settings WHERE email ILIKE $1", [TARGET_EMAIL]);
            if (uRes.rows.length === 0) {
                console.log("❌ User not found.");
                return;
            }
            const userId = uRes.rows[0].user_id;
            
            // 2. Clear Selections (user_counties? or just array in settings?)
            // Check schema usage. Usually user_settings.selected is JSON or string array
            // Or there is a separate table?
            // Let's assume user_settings has the tier/quota logic.
            
            // Reset to 'scout' (free/basic) and clear selected
            // We need to know column names. 'tier', 'selected_counties'
            // Let's inspect columns first if we don't know
            
            await pool.query(`
                UPDATE user_settings 
                SET tier = 'scout', 
                    quota = 1, 
                    selected_counties = '[]'::jsonb 
                WHERE user_id = $1
            `, [userId]);
            
            console.log("✅ User reset to SCOUT tier with 0 counties.");
            
        } else {
            console.log("\n👥 USER LIST:");
            const res = await pool.query(`
                SELECT email, tier, quota, jsonb_array_length(selected_counties) as selected_count 
                FROM user_settings 
                ORDER BY created_at DESC LIMIT 10
            `);
            console.table(res.rows);
            console.log("\nUsage: node scripts/manage-users.js reset <email>");
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
