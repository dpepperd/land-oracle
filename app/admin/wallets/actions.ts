'use server';

// Admin-only, read-only: customer wallets. Every action checks requireAdmin() first (it redirects anyone who is not an admin).
import { requireAdmin } from '@/lib/auth-guard';
import pool from '@/lib/db';
import { listWallets, walletDetail, walletOverview } from '@/lib/wallet/admin';

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
