import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { TIER_QUOTAS } from '@/lib/counties';
import { isClerkAdmin } from '@/lib/admin';
import { getEntitlements } from '@/lib/entitlements';

export async function GET(request: Request) {
  const { userId } = await auth();
  const { searchParams } = new URL(request.url);
  const simulate = searchParams.get('simulate');

  // Allow Public Access for "Live Map" checking (guests never touch the DB)
  if (!userId) {
     try {
        // OPTIMIZATION: Use predefined list for guests to avoid heavy scan
        // const liveRes = await client.query('SELECT DISTINCT county FROM parcels ORDER BY county');
        // const liveCounties = liveRes.rows.map(r => r.county);
        
        const { LIVE_COUNTIES } = await import('@/lib/counties');
        const liveCounties = LIVE_COUNTIES; 

        return NextResponse.json({
            tier: 'guest',
            role: 'guest',
            quota: 0,
            used: 0,
            selected: [],
            liveCounties
        });
     } catch(e) {
        return new NextResponse("Error fetching live counties", { status: 500 });
     }
  }

  const client = await pool.connect();

  try {
    // Check user tier
    // Schema: id, clerk_id, subscription_tier
    let userRes = await client.query('SELECT * FROM users WHERE clerk_id = $1', [userId]);
    let user = userRes.rows[0];

    // Lazy Create User if missing (Simulates Webhook for Local Dev)
    if (!user) {
        const clerkUser = await currentUser();
        const email = clerkUser?.emailAddresses[0]?.emailAddress || 'unknown@example.com';
        
        const role = isClerkAdmin(clerkUser) ? 'admin' : 'user';
        
        await client.query(`
            INSERT INTO users (clerk_id, email, subscription_tier, role)
            VALUES ($1, $2, 'demo', $3)
        `, [userId, email, role]);
        
        // Refetch
        userRes = await client.query('SELECT * FROM users WHERE clerk_id = $1', [userId]);
        user = userRes.rows[0];
    }
    
    let tier = user?.subscription_tier || 'demo'; 
    const dbUserId = user?.id;

    // Check Trial Expiration
    if (tier === 'trial') {
        const userWithDates = (await client.query('SELECT trial_ends_at FROM users WHERE id = $1', [dbUserId])).rows[0];
        if (userWithDates && new Date(userWithDates.trial_ends_at) < new Date()) {
            tier = 'demo'; // Expired
        }
    }

    let selectedCounties: string[] = [];
    
    // Auto-unlock all for Admin
    if (user?.role === 'admin') {
        const { FLORIDA_COUNTIES } = await import('@/lib/counties');
        selectedCounties = FLORIDA_COUNTIES;
        tier = 'enterprise'; // Force enterprise behavior for admins
    } else if (dbUserId) {
        // Schema: user_id (int), county
        const accessRes = await client.query('SELECT county FROM user_county_access WHERE user_id = $1', [dbUserId]);
        selectedCounties = accessRes.rows.map(r => r.county);
    }
    
    const ent = await getEntitlements(userId);
    const quota = ent.allowance;
    tier = ent.tier;

    // AUTOMATION: Use static list to prevent timeout on large datasets
    // const liveRes = await client.query('SELECT DISTINCT county FROM parcels ORDER BY county');
    // const liveCounties = liveRes.rows.map(r => r.county);
    const { LIVE_COUNTIES } = await import('@/lib/counties');
    const liveCounties = LIVE_COUNTIES;

    // --- SIMULATION MODE ---
    if (user?.role === 'admin' && simulate) {
        const simTier = simulate as keyof typeof TIER_QUOTAS;
        const simQuota = TIER_QUOTAS[simTier] || 1;
        return NextResponse.json({
            tier: simulate,
            role: 'admin', // Keep role but simulate tier
            quota: simQuota,
            used: 0,
            selected: [], // Empty selection for testing
            liveCounties,
            isSimulation: true
        });
    }

    return NextResponse.json({
      tier,
      role: user?.role || 'user',
      quota,
      used: selectedCounties.length, // Can be > quota if admin
      selected: selectedCounties,
      liveCounties,
      needsCountyRepick: ent.needsCountyRepick,
      subscriptionStatus: ent.subscriptionStatus,
      cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching user counties:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { county } = await req.json();
  if (!county) return new NextResponse("County required", { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get User
    const userRes = await client.query('SELECT id, subscription_tier FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];

    // If user not in DB, we can't associate county access (because we need int ID)
    if (!user) {
        await client.query('ROLLBACK');
        return new NextResponse("User profile not initialized. Please sign out and sign in again.", { status: 403 });
    }

    const ent = await getEntitlements(userId);
    const tier = ent.tier;
    const quota = ent.allowance;
    const dbUserId = user.id;

    // 2. Check current usage
    const accessRes = await client.query('SELECT COUNT(*) FROM user_county_access WHERE user_id = $1', [dbUserId]);
    const used = parseInt(accessRes.rows[0].count);

    // 3. Check if already selected
    const checkRes = await client.query('SELECT 1 FROM user_county_access WHERE user_id = $1 AND county = $2', [dbUserId, county]);
    if ((checkRes.rowCount || 0) > 0) {
      await client.query('ROLLBACK');
      return new NextResponse("County already selected", { status: 400 });
    }

    // 4. Check Quota
    if (used >= quota) {
      await client.query('ROLLBACK');
      return new NextResponse("Quota exceeded. Upgrade to add more counties.", { status: 403 });
    }

    // 5. Insert
    await client.query('INSERT INTO user_county_access (user_id, county) VALUES ($1, $2)', [dbUserId, county]);
    
    await client.query('COMMIT');
    return NextResponse.json({ success: true, county, used: used + 1, quota });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding county:', error);
    return new NextResponse("Internal Error: " + (error as Error).message, { status: 500 });
  } finally {
    client.release();
  }
}
