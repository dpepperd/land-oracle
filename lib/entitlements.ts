import pool from './db';

export type Tier = 'free' | 'scout' | 'local' | 'regional' | 'statewide' | 'enterprise';

export interface EntitlementStatus {
  tier: Tier;
  trialActive: boolean;
  daysRemaining?: number;
  counties: string[] | 'all';
  exports: {
    used: number;
    limit: number | 'unlimited';
  };
}

// Map tiers to export limits (monthly or lifetime for trial)
const EXPORT_LIMITS = {
  free: 100,      // Lifetime (Trial)
  scout: 1000,    // Monthly
  local: 100000,  // "Unlimited" (Fair Use)
  regional: 100000,
  statewide: 100000,
  enterprise: 100000
};

/**
 * Get full entitlement context for a user.
 */
export async function getEntitlements(clerkId: string): Promise<EntitlementStatus> {
  const client = await pool.connect();
  try {
    // Get User & Tier
    const userRes = await client.query(
      `SELECT id, subscription_tier, trial_ends_at FROM users WHERE clerk_id = $1`,
      [clerkId]
    );

    if (userRes.rowCount === 0) {
      throw new Error('User not found');
    }

    const  user = userRes.rows[0];
    const tier = (user.subscription_tier || 'free') as Tier;
    
    // Check Trial
    const now = new Date();
    let trialActive = false;
    let daysRemaining = 0;
    
    if (tier === 'free' && user.trial_ends_at) {
        const end = new Date(user.trial_ends_at);
        if (end > now) {
            trialActive = true;
            daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
    }

    // Get County Access
    let counties: string[] | 'all' = [];
    if (['local', 'regional', 'statewide', 'enterprise'].includes(tier)) {
        counties = 'all';
    } else {
        // Free/Scout: Fetch assigned counties
        const countyRes = await client.query(
            `SELECT county FROM user_county_access WHERE user_id = $1`,
            [user.id]
        );
        counties = countyRes.rows.map(r => r.county);
    }

    // Get Export Usage
    const usageRes = await client.query(
        `SELECT lifetime_count, monthly_count FROM user_usage_exports WHERE user_id = $1`,
        [user.id]
    );
    
    const used = tier === 'free' 
        ? (usageRes.rows[0]?.lifetime_count || 0)
        : (usageRes.rows[0]?.monthly_count || 0);

    const limit = EXPORT_LIMITS[tier] || 100;

    return {
        tier,
        trialActive,
        daysRemaining: trialActive ? daysRemaining : undefined,
        counties,
        exports: {
            used,
            limit: limit === 100000 ? 'unlimited' : limit
        }
    };

  } finally {
    client.release();
  }
}

/**
 * Check if user can access a specific county.
 */
export async function hasCountyAccess(clerkId: string, county: string): Promise<boolean> {
    const entitlements = await getEntitlements(clerkId);
    
    if (entitlements.counties === 'all') return true;
    
    // Normalize county string (e.g. "Clay County" vs "Clay")
    // Assuming DB stores "Clay", but input might vary. 
    // For now, simpler exact match or partial match.
    const normalizedInput = county.replace(' County', '').trim();
    
    return entitlements.counties.some(c => c.replace(' County', '').trim() === normalizedInput);
}

/**
 * Claim a county for a Free/Scout user (if they haven't already).
 * Returns true if successful, false if already claimed a different county.
 */
export async function claimCounty(clerkId: string, county: string): Promise<boolean> {
    const entitlements = await getEntitlements(clerkId);
    
    if (entitlements.counties === 'all') return true; // Already has all
    if (entitlements.counties.length > 0) {
        // Already has a county. Check if it's the same one.
        return hasCountyAccess(clerkId, county);
    }

    // If no county, grant access
    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM users WHERE clerk_id = $1`, [clerkId]);
        const userId = userRes.rows[0].id;
        
        await client.query(
            `INSERT INTO user_county_access (user_id, county) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, county]
        );
        return true;
    } catch (e) {
        console.error('Error claiming county:', e);
        return false;
    } finally {
        client.release();
    }
}

/**
 * Increment export usage. Returns false if limit reached.
 */
export async function trackExport(clerkId: string, count: number): Promise<{ allowed: boolean; remaining: number }> {
    const ent = await getEntitlements(clerkId);
    
    if (ent.exports.limit !== 'unlimited' && (ent.exports.used + count) > ent.exports.limit) {
        return { allowed: false, remaining: ent.exports.limit - ent.exports.used };
    }

    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM users WHERE clerk_id = $1`, [clerkId]);
        const userId = userRes.rows[0].id;

        await client.query(`
            INSERT INTO user_usage_exports (user_id, lifetime_count, monthly_count)
            VALUES ($1, $2, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                lifetime_count = user_usage_exports.lifetime_count + $2,
                monthly_count = user_usage_exports.monthly_count + $2
        `, [userId, count]);
        
        return { allowed: true, remaining: (ent.exports.limit as number) - (ent.exports.used + count) };
    } finally {
        client.release();
    }
}
