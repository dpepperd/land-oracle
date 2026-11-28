'use server';

// Admin only: customer wallets. Every action checks requireAdmin() first (it redirects anyone who is not an admin).
// The reads move no money. The three writes (unpause a wallet, close an incident, add or remove money) each need a written note and leave an audit row.
import { currentUser } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/auth-guard';
import pool from '@/lib/db';
import { listWallets, walletDetail, walletOverview } from '@/lib/wallet/admin';
import { adminAdjust, adminResolveIncident, adminUnfreeze } from '@/lib/wallet/disputes';
import { parseUsdToCents } from '@/lib/wallet/money';

async function adminDbId(): Promise<number | null> {
  const u = await currentUser();
  if (!u) return null;
  const r = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [u.id]);
  return r.rows[0]?.id ?? null;
}

export async function loadWalletOverview() {
  await requireAdmin();
  return walletOverview(pool);
}

export async function loadWalletList(q: string, page: number) {
  await requireAdmin();
  const p = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0;
  return listWallets(pool, { q: String(q ?? '').slice(0, 100), limit: 50, offset: p * 50 });
}

export async function loadWalletDetail(userId: number) {
  await requireAdmin();
  return walletDetail(pool, Number(userId));
}

/** Lets a paused wallet spend again (after a dispute is settled and you have reviewed it). */
export async function unfreezeWallet(userId: number, note: string) {
  await requireAdmin();
  return adminUnfreeze(pool, { userId: Number(userId), adminId: await adminDbId(), note: String(note ?? '') });
}

/** Marks an incident (refund shortfall, open or lost dispute) as dealt with. */
export async function resolveWalletIncident(incidentId: number, note: string) {
  await requireAdmin();
  return adminResolveIncident(pool, { incidentId: Number(incidentId), adminId: await adminDbId(), note: String(note ?? '') });
}

/** Adds or removes money by hand. `dollars` is a plain amount like "5.00"; the direction is separate so a typo cannot flip the sign. */
export async function adjustWalletBalance(userId: number, direction: string, dollars: string, reason: string, token: string) {
  await requireAdmin();
  if (direction !== 'add' && direction !== 'remove') return { ok: false as const, message: 'Choose add or remove.' };
  const cents = parseUsdToCents(String(dollars ?? ''));
  if (cents === null || cents === 0) return { ok: false as const, message: 'Enter the amount like 5.00.' };
  return adminAdjust(pool, { userId: Number(userId), cents: direction === 'add' ? cents : -cents, adminId: await adminDbId(), reason: String(reason ?? ''), token: String(token ?? '') });
}
