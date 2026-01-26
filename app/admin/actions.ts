'use server';

import { requireAdmin } from '@/lib/auth-guard';
import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getAdminUsers() {
    await requireAdmin();
    
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT 
                u.id, 
                u.email, 
                u.created_at, 
                u.subscription_tier, 
                u.role, 
                u.beta_access,
                u.trial_ends_at,
                (SELECT COUNT(*) FROM user_usage_searches s WHERE s.user_id = u.id AND s.date = CURRENT_DATE) as searches_today,
                (SELECT COUNT(*) FROM user_county_access c WHERE c.user_id = u.id) as counties_count
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT 100
        `);
        return res.rows;
    } finally {
        client.release();
    }
}

export async function toggleBetaAccess(userId: number, status: boolean) {
    await requireAdmin();
    
    const client = await pool.connect();
    try {
        await client.query(`
            UPDATE users SET beta_access = $2 WHERE id = $1
        `, [userId, status]);
        revalidatePath('/admin');
        return { success: true };
    } catch (e) {
        console.error('Error toggling beta', e);
        return { success: false, error: 'Database error' };
    } finally {
        client.release();
    }
}
