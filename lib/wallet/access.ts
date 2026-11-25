// Who may use the wallet. Admins always (so it can be tried on a preview); everyone else only once WALLET_ENABLED=true.
// Checked on every request, so the wallet can be switched off instantly.
import pool from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';

export const walletOpenToAll = () => process.env.WALLET_ENABLED === 'true';

/** Money only moves in Stripe TEST mode: a live key is refused unless WALLET_ALLOW_LIVE=true is set on purpose. */
export const stripeAllowedForWallet = (key = process.env.STRIPE_SECRET_KEY ?? '') => key.startsWith('sk_test_') || process.env.WALLET_ALLOW_LIVE === 'true';

export interface WalletUser { id: number; isAdmin: boolean; open: boolean }

export async function walletUser(clerkId: string): Promise<WalletUser | null> {
  const u = (await pool.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0];
  if (!u) return null;
  let isAdmin = false;
  try { isAdmin = (await getEntitlements(clerkId)).isAdmin; } catch { isAdmin = false; }
  return { id: u.id, isAdmin, open: isAdmin || walletOpenToAll() };
}
