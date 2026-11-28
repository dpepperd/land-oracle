// Owner contact lookup (skip tracing), paid from the wallet. OFF unless SKIPTRACE_ENABLED=true: when off, GET says so and POST answers 404.
// Signed-in users only (API routes are private by default, see proxy.ts). Never logs phone numbers or emails.
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { lookupForParcel, skipTraceEnabled, skipTraceOffer } from '@/lib/skiptrace/service';
import { SkipTraceError } from '@/lib/skiptrace/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const bodySchema = z.object({ parcel_key: z.string().min(5).max(80), dnc: z.boolean().optional() });

/**
 * Lets the screen decide whether to show the button and what to say on it:
 * { enabled, balanceCents, contactCents, dnc: { mode: 'optional' | 'required', cents } | null, totalCents }. All money is whole cents.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  if (!skipTraceEnabled()) return json(200, { enabled: false });
  const u = (await pool.query('SELECT id FROM users WHERE clerk_id = $1', [userId])).rows[0];
  if (!u) return json(200, { enabled: false });
  const offer = await skipTraceOffer(u.id);
  if (!offer.available) return json(200, { enabled: false });
  return json(200, { enabled: true, balanceCents: offer.balanceCents, contactCents: offer.contactCents, dnc: offer.dnc, totalCents: offer.totalCents });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  if (!skipTraceEnabled()) return json(404, { error: 'not_available', message: 'Owner contact lookup is not available.' });
  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return json(400, { error: 'bad_request', message: 'A parcel_key is required.' }); }
  try {
    const out = await lookupForParcel(userId, body.parcel_key, { dnc: body.dnc });
    return json(200, out);
  } catch (e) {
    if (e instanceof SkipTraceError) return json(e.status, { error: e.code, message: e.message });
    console.error('[skiptrace] failure', (e as Error)?.message);
    return json(500, { error: 'failed', message: 'Something went wrong. Please try again.' });
  }
}
