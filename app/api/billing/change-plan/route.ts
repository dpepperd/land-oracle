import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import pool from '@/lib/db';
import { PLANS, lookupKey } from '@/lib/plans';

export const runtime = 'nodejs';

const bodySchema = z.object({
  plan: z.enum(['scout', 'pro', 'statewide']),
  interval: z.enum(['month', 'year']),
  addonCounties: z.number().int().min(0).max(66).default(0),
});

// Upgrade/downgrade an existing subscription in place (prorated). Entitlements update via the customer.subscription.updated webhook;
// on a downgrade the webhook keeps the user's first N counties and flags needs_county_repick.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const addon = PLANS[body.plan].addonAllowed ? body.addonCounties : 0;

  const r = await pool.query('SELECT stripe_subscription_id FROM users WHERE clerk_id = $1', [userId]);
  const subId = r.rows[0]?.stripe_subscription_id;
  if (!subId) return NextResponse.json({ error: 'No active subscription. Subscribe from the pricing page.' }, { status: 409 });

  const keys = [lookupKey(body.plan, body.interval), lookupKey('addon_county', body.interval)];
  const prices = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  const byKey = new Map(prices.data.map((p) => [p.lookup_key, p]));
  if (keys.some((k) => !byKey.has(k))) return NextResponse.json({ error: 'Billing is not configured yet.' }, { status: 503 });

  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
  const isAddon = (i: any) => String(i.price?.lookup_key ?? '').startsWith('addon_county_');
  const baseItem = sub.items.data.find((i) => !isAddon(i));
  const addonItem = sub.items.data.find(isAddon);
  if (!baseItem) return NextResponse.json({ error: 'Subscription has no base plan item.' }, { status: 409 });

  const items: any[] = [{ id: baseItem.id, price: byKey.get(keys[0])!.id, quantity: 1 }];
  if (addon > 0) items.push(addonItem ? { id: addonItem.id, price: byKey.get(keys[1])!.id, quantity: addon } : { price: byKey.get(keys[1])!.id, quantity: addon });
  else if (addonItem) items.push({ id: addonItem.id, deleted: true });

  try {
    const updated = await stripe.subscriptions.update(subId, { items, proration_behavior: 'create_prorations', cancel_at_period_end: false });
    return NextResponse.json({ success: true, status: updated.status });
  } catch (e: any) {
    console.error('[change-plan]', e?.message);
    return NextResponse.json({ error: 'Could not change plan.' }, { status: 500 });
  }
}
