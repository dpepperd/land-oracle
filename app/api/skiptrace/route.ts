// Owner contact lookup (skip tracing). OFF unless SKIPTRACE_ENABLED=true: when off, GET says so and POST answers 404.
// Signed-in users only (API routes are private by default, see proxy.ts). Never logs phone numbers or emails.
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { creditsFor, lookupForParcel, skipTraceEnabled } from '@/lib/skiptrace/service';
import { SkipTraceError } from '@/lib/skiptrace/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const bodySchema = z.object({ parcel_key: z.string().min(5).max(80) });

/** Lets the screen decide whether to show the button: { enabled, credits? }. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  if (!skipTraceEnabled()) return json(200, { enabled: false });
  const u = (await pool.query('SELECT id FROM users WHERE clerk_id = $1', [userId])).rows[0];
  if (!u) return json(200, { enabled: false });
  return json(200, { enabled: true, credits: await creditsFor(u.id) });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  if (!skipTraceEnabled()) return json(404, { error: 'not_available', message: 'Owner contact lookup is not available.' });
  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return json(400, { error: 'bad_request', message: 'A parcel_key is required.' }); }
  try {
    const out = await lookupForParcel(userId, body.parcel_key);
    return json(200, out);
  } catch (e) {
    if (e instanceof SkipTraceError) return json(e.status, { error: e.code, message: e.message });
    console.error('[skiptrace] failure', (e as Error)?.message);
    return json(500, { error: 'failed', message: 'Something went wrong. Please try again.' });
  }
}
