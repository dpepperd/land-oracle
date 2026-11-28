// Preview of a postcard before sending: the exact front and back HTML that would go to Lob, plus the price and whether the balance covers it.
// Free: no Lob call, no charge, nothing saved.
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { walletUser } from '@/lib/wallet/access';
import { AssetError, loadImages } from '@/lib/wallet/assets';
import { getAvailable } from '@/lib/wallet/ledger';
import { buildPreview, postcardSchema } from '@/lib/wallet/postcards';
import { getPrices, postcardItem, type PostcardSize } from '@/lib/wallet/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  const u = await walletUser(userId);
  if (!u || !u.open) return json(404, { error: 'not_available', message: 'Postcards are not available yet.' });
  const parsed = postcardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'bad_request', message: parsed.error.issues[0]?.message ?? 'Check the postcard details.' });
  try {
    const images = await loadImages(pool, u.id, { logo: parsed.data.logoAssetId, photo: parsed.data.photoAssetId });
    const rendered = buildPreview(parsed.data, images);
    let price = null as { cents: number; enabled: boolean } | null;
    try { price = (await getPrices(pool))[postcardItem(parsed.data.size as PostcardSize)]; } catch { price = null; }
    const balanceCents = await getAvailable(pool, u.id);
    return json(200, { ...rendered, priceCents: price?.cents ?? null, available: !!price?.enabled, balanceCents, canAfford: !!price?.enabled && balanceCents >= price.cents });
  } catch (e: any) {
    if (e instanceof AssetError) return json(400, { error: 'bad_image', message: e.message });
    console.error('[postcards-preview] failure', e?.message);
    return json(500, { error: 'failed', message: 'Could not build the preview.' });
  }
}
