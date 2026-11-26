import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { buildBillingSummary } from '@/lib/billing-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The signed-in user's own subscription details, for the post-checkout banner. Read-only. No Stripe ids are returned.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = (await pool.query(
    `SELECT subscription_tier, subscription_status, plan_interval, county_allowance, current_period_end, cancel_at_period_end, email
       FROM users WHERE clerk_id = $1`, [userId])).rows[0];
  if (!row) return NextResponse.json({ error: 'Account is still being set up' }, { status: 404 });

  const ent = await getEntitlements(userId);
  return NextResponse.json(buildBillingSummary(row, ent.counties), { headers: { 'Cache-Control': 'no-store' } });
}
