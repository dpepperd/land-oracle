// Wallet overview: balance, recent ledger, prices. Signed-in users only; admins always, everyone else once WALLET_ENABLED=true.
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { walletUser } from '@/lib/wallet/access';
import { getAvailable, getHeld, recentLedger } from '@/lib/wallet/ledger';
import { getPrices } from '@/lib/wallet/settings';
import { BILLING_ENTITY, MAX_TOPUP_CENTS, MIN_TOPUP_CENTS } from '@/lib/wallet/money';
import { TOPUP_PACKS_CENTS } from '@/lib/wallet/topup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function GET() {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  const u = await walletUser(userId);
  if (!u || !u.open) return json(200, { enabled: false });
  let prices = null;
  try { prices = await getPrices(pool); } catch { prices = null; }
  return json(200, {
    enabled: true,
    balanceCents: await getAvailable(pool, u.id), // spendable money (money held for a service in progress is not shown as spendable)
    heldCents: await getHeld(pool, u.id),
    ledger: await recentLedger(pool, u.id),
    prices, // cents, from admin settings
    packsCents: TOPUP_PACKS_CENTS, minTopupCents: MIN_TOPUP_CENTS, maxTopupCents: MAX_TOPUP_CENTS,
    billingEntity: BILLING_ENTITY,
  });
}
