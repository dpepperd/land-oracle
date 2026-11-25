// Uploaded postcard logos and photos. Server-only (uses sharp).
//   - only real PNG or JPEG files (checked by their first bytes, never by file name or the browser's claim): no SVG, no GIF, no PDF;
//   - decoded, rotated upright, resized, and re-encoded: this removes any hidden data (including GPS location) and anything that is not pixels;
//   - kept small so the card's HTML stays light; saved against the account that uploaded it and only usable by that account.
// The processed image is embedded in the card as a data: address, so Lob never needs a public link to a user's file.
import sharp from 'sharp';
import type { Pool } from 'pg';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit
export type AssetKind = 'logo' | 'photo';

export class AssetError extends Error {
  constructor(message: string) { super(message); this.name = 'AssetError'; }
}

export function sniffImage(b: Buffer): 'image/png' | 'image/jpeg' | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  return null;
}

export interface ProcessedImage { mime: 'image/png' | 'image/jpeg'; bytes: Buffer; width: number; height: number; warnings: string[] }

export async function processImage(input: Buffer, kind: AssetKind): Promise<ProcessedImage> {
  if (input.length === 0) throw new AssetError('That file is empty.');
  if (input.length > MAX_UPLOAD_BYTES) throw new AssetError('That file is too big. Please use an image under 4 MB.');
  if (!sniffImage(input)) throw new AssetError('Only PNG or JPG images can be used.');
  const warnings: string[] = [];
  try {
    const base = () => sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate(); // rotate() applies the camera's orientation, then metadata is dropped
    const meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
    const w0 = meta.width ?? 0; const h0 = meta.height ?? 0;
    if (w0 < 100 || h0 < 100) throw new AssetError('That image is too small. Use one at least 100 pixels wide and tall.');
    if (kind === 'logo') {
      let max = 800; let out = await base().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
      while (out.data.length > 700_000 && max > 300) { max = Math.round(max * 0.75); out = await base().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true }); }
      if (Math.max(out.info.width, out.info.height) < 300) warnings.push('This logo is small and may print soft.');
      return { mime: 'image/png', bytes: out.data, width: out.info.width, height: out.info.height, warnings };
    }
    let q = 78;
    let out = await base().flatten({ background: '#ffffff' }).resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    while (out.data.length > 1_200_000 && q > 40) { q -= 12; out = await base().flatten({ background: '#ffffff' }).resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer({ resolveWithObject: true }); }
    if (Math.max(out.info.width, out.info.height) < 1200) warnings.push('This photo is low resolution and may look blurry when printed.');
    return { mime: 'image/jpeg', bytes: out.data, width: out.info.width, height: out.info.height, warnings };
  } catch (e) {
    if (e instanceof AssetError) throw e;
    throw new AssetError('That image could not be read. Try saving it again as a PNG or JPG.');
  }
}

export async function saveAsset(pool: Pool, userId: number, kind: AssetKind, p: ProcessedImage): Promise<number> {
  const r = await pool.query('INSERT INTO postcard_assets (user_id, kind, mime, width, height, bytes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [userId, kind, p.mime, p.width, p.height, p.bytes]);
  return Number(r.rows[0].id);
}

export const toDataUri = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;

/** Loads the account's own uploads as data URIs. An id that is missing, the wrong kind, or someone else's is refused. */
export async function loadImages(pool: Pool, userId: number, ids: { logo?: number; photo?: number }): Promise<{ logo?: string; photo?: string }> {
  const out: { logo?: string; photo?: string } = {};
  for (const kind of ['logo', 'photo'] as const) {
    const id = ids[kind];
    if (!id) continue;
    const r = (await pool.query('SELECT mime, bytes FROM postcard_assets WHERE id = $1 AND user_id = $2 AND kind = $3', [id, userId, kind])).rows[0];
    if (!r) throw new AssetError(`The ${kind} you chose could not be found. Please upload it again.`);
    out[kind] = toDataUri(r.mime, r.bytes);
  }
  return out;
}
