// Upload a logo or photo for postcards (multipart: kind = logo | photo, file). PNG or JPEG only; resized and cleaned (see lib/wallet/assets.ts).
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { walletUser } from '@/lib/wallet/access';
import { AssetError, MAX_UPLOAD_BYTES, processImage, saveAsset } from '@/lib/wallet/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STORED_PER_ACCOUNT = 40;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  const u = await walletUser(userId);
  if (!u || !u.open) return json(404, { error: 'not_available', message: 'Postcards are not available yet.' });
  let form: FormData;
  try { form = await req.formData(); } catch { return json(400, { error: 'bad_request', message: 'Choose an image file.' }); }
  const kind = form.get('kind');
  const file = form.get('file');
  if ((kind !== 'logo' && kind !== 'photo') || !(file instanceof File)) return json(400, { error: 'bad_request', message: 'Choose a logo or a photo to upload.' });
  if (file.size > MAX_UPLOAD_BYTES) return json(400, { error: 'bad_image', message: 'That file is too big. Please use an image under 4 MB.' });
  try {
    const count = Number((await pool.query('SELECT count(*)::int n FROM postcard_assets WHERE user_id = $1', [u.id])).rows[0].n);
    if (count >= MAX_STORED_PER_ACCOUNT) return json(429, { error: 'too_many', message: 'You have reached the upload limit. Contact support to clear old images.' });
    const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind);
    const id = await saveAsset(pool, u.id, kind, processed);
    return json(200, { id, kind, width: processed.width, height: processed.height, warnings: processed.warnings });
  } catch (e: any) {
    if (e instanceof AssetError) return json(400, { error: 'bad_image', message: e.message });
    console.error('[postcard-assets] failure', e?.message);
    return json(500, { error: 'failed', message: 'Could not save that image.' });
  }
}
