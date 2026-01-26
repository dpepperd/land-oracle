import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  // We track analytics even for unauthenticated users if we link to a session ID later, 
  // but for now let's just track logged in 'demo' users.
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { eventType } = await req.json(); // 'view_parcel', 'attempt_export', 'click_upgrade'

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT id FROM users WHERE clerk_id = $1', [userId]);
    const dbUserId = userRes.rows[0]?.id;

    if (!dbUserId) return new NextResponse("User not found", { status: 404 });

    // Check for open session today? Or just last session? 
    // Schema: demo_sessions (id, session_started, parcels_viewed, export_attempts, upgrade_clicks)
    // Let's create a daily session or just update the latest one if it's recent (e.g. < 1 hour).
    
    // Simple logic: Find active session (started within last 1 hour), else create new.
    const sessionRes = await client.query(`
        SELECT id FROM demo_sessions 
        WHERE user_id = $1 
        AND session_started > NOW() - INTERVAL '1 hour'
        ORDER BY session_started DESC LIMIT 1
    `, [dbUserId]);

    let sessionId = sessionRes.rows[0]?.id;

    if (!sessionId) {
        const insertRes = await client.query(`
            INSERT INTO demo_sessions (user_id) VALUES ($1) RETURNING id
        `, [dbUserId]);
        sessionId = insertRes.rows[0].id;
    }

    // Update counters
    if (eventType === 'view_parcel') {
        await client.query('UPDATE demo_sessions SET parcels_viewed = parcels_viewed + 1 WHERE id = $1', [sessionId]);
    } else if (eventType === 'attempt_export') {
        await client.query('UPDATE demo_sessions SET export_attempts = export_attempts + 1 WHERE id = $1', [sessionId]);
    } else if (eventType === 'click_upgrade') {
        await client.query('UPDATE demo_sessions SET upgrade_clicks = upgrade_clicks + 1 WHERE id = $1', [sessionId]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics Error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
