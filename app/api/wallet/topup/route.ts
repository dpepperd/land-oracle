// Starts a Stripe Checkout for a wallet top-up ($20 minimum). TEST mode only until WALLET_ALLOW_LIVE=true. The wallet is credited by the webhook, not here.
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import pool from '@/lib/db';
import { stripeAllowedForWallet, walletUser } from '@/lib/wallet/access';
import { topupAmountError, topupSessionParams } from '@/lib/wallet/topup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const bodySchema = z.object({ amountCents: z.number() });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  const u = await walletUser(userId);
  if (!u || !u.open) return json(404, { error: 'not_available', message: 'The wallet is not available yet.' });
  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return json(400, { error: 'bad_request', message: 'Enter an amount.' }); }
  const bad = topupAmountError(body.amountCents);
  if (bad) return json(400, { error: 'bad_amount', message: bad });
  if (!stripeAllowedForWallet()) return json(503, { error: 'test_mode_only', message: 'Wallet top-ups are in test mode only for now.' });
  try {
    const row = (await pool.query('SELECT stripe_customer_id, email FROM users WHERE id = $1', [u.id])).rows[0];
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create(topupSessionParams({ amountCents: body.amountCents, clerkId: userId, origin, stripeCustomerId: row?.stripe_customer_id, email: row?.email }));
    return json(200, { url: session.url });
  } catch (e: any) {
    console.error('[wallet-topup] error', e?.message);
    return json(500, { error: 'failed', message: 'Could not start the top-up.' });
  }
}
