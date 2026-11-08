'use server';

import { auth } from '@clerk/nextjs/server';
import { claimCounty, hasCountyAccess, getEntitlements, setCounties } from '@/lib/entitlements';
import { revalidatePath } from 'next/cache';
import { requireBetaAccess } from '@/lib/auth-guard';

export async function claimCountyAction(county: string) {
  await requireBetaAccess(); // Enforce Beta Access
  const { userId } = await auth();
  
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // 1. Check if already has access (to prevent burning trial on same county)
    const hasAccess = await hasCountyAccess(userId, county);
    if (hasAccess) {
        return { success: true, message: 'Already have access' };
    }

    // 2. Attempt Claim
    const claim = await claimCounty(userId, county);
    
    if (!claim.ok) {
        return { success: false, error: claim.reason === 'full' ? 'Your plan has no county slots left. Add counties or upgrade.' : 'Could not select this county.' };
    }

    // 3. Revalidate to update UI
    revalidatePath('/');
    revalidatePath('/territories');
    revalidatePath('/dashboard');
    
    return { success: true };
    
  } catch (error) {
    console.error('Claim Action Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function checkEntitlementsAction() {
    const { userId } = await auth();
    if (!userId) return null;
    return await getEntitlements(userId);
}

export async function setCountiesAction(counties: string[]) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };
  if (!Array.isArray(counties) || counties.length > 67 || counties.some((c) => typeof c !== 'string' || c.length > 40)) return { success: false, error: 'Invalid selection' };
  const r = await setCounties(userId, counties);
  if (r.ok) { revalidatePath('/dashboard'); revalidatePath('/territories'); }
  return { success: r.ok, error: r.error };
}
