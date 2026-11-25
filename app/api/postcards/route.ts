// Send a postcard (Lob). Address is verified first; the wallet is charged only after Lob accepts the card. See lib/wallet/postcards.ts.
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { walletUser } from '@/lib/wallet/access';
import { makeLobClient } from '@/lib/wallet/lob';
import { postcardSchema, sendPostcard } from '@/lib/wallet/postcards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const STATUS = { insufficient_funds: 402, address_rejected: 422, not_set_up: 503, mail_failed: 502, busy: 409 } as const;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  const u = await walletUser(userId);
  if (!u || !u.open) return json(404, { error: 'not_available', message: 'Postcards are not available yet.' });
  let body;
  const parsed = postcardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'bad_request', message: parsed.error.issues[0]?.message ?? 'Check the postcard details.' });
  body = parsed.data;
  try {
    const out = await sendPostcard({ pool, lob: makeLobClient() }, u.id, body);
    if (out.ok) return json(200, out);
    return json(STATUS[out.code], { error: out.code, message: out.message, balanceCents: out.balanceCents, priceCents: out.priceCents });
  } catch (e: any) {
    console.error('[postcards] failure', e?.message);
    return json(500, { error: 'failed', message: 'Something went wrong. Check your wallet history before trying again.' });
  }
}
