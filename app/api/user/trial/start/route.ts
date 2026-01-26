import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT id, subscription_tier, trial_started_at FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];

    if (!user) return new NextResponse("User not found", { status: 404 });

    // Check availability
    if (user.subscription_tier !== 'demo' && user.subscription_tier !== 'free') {
        return new NextResponse("Already on a paid plan or trial", { status: 400 });
    }
    if (user.trial_started_at) {
        return new NextResponse("Trial already used", { status: 400 });
    }

    // Start 7-day trial
    await client.query(`
        UPDATE users 
        SET subscription_tier = 'trial', 
            subscription_status = 'trialing',
            trial_started_at = NOW(),
            trial_ends_at = NOW() + INTERVAL '7 days'
        WHERE id = $1
    `, [user.id]);

    return NextResponse.json({ success: true, tier: 'trial' });

  } catch (error) {
    console.error('Trial Start Error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
