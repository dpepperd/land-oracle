'use server';

import { auth } from '@clerk/nextjs/server';
import { claimCounty, hasCountyAccess, getEntitlements } from '@/lib/entitlements';
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
    const success = await claimCounty(userId, county);
    
    if (!success) {
        return { success: false, error: 'Could not claim county. You may have already selected your trial territory.' };
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
