import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { floodAt } from '@/lib/fema';

export const dynamic = 'force-dynamic';

const MAX_POINTS = 60;
const CONCURRENCY = 10;

// POST { points: [{ key, lat, lon }] } -> { results: { [key]: { zone, sfha, source } } }
// Signed-in users only (API routes are protected by default). Points are limited to Florida.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const raw = Array.isArray(body?.points) ? body.points.slice(0, MAX_POINTS) : [];
  const points = raw
    .map((p: any) => ({ key: String(p?.key ?? ''), lat: Number(p?.lat), lon: Number(p?.lon) }))
    .filter((p: any) => p.key && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat > 24 && p.lat < 31.5 && p.lon > -88 && p.lon < -79.5);

  const results: Record<string, { zone: string | null; sfha: boolean; source: string }> = {};
  let i = 0;
  const worker = async () => {
    while (i < points.length) {
      const p = points[i++];
      results[p.key] = await floodAt(p.lat, p.lon);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, points.length) }, worker));
  return NextResponse.json({ results });
}
