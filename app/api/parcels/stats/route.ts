import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Public endpoint (county counts only, no parcel/owner data).
// The underlying GROUP BY scans ~11M rows, so results are cached for 1 hour
// in-memory (per server instance) and at the CDN via Cache-Control.
const TTL_MS = 60 * 60 * 1000;

let cache: { at: number; stats: Record<string, number> } | null = null;
let inflight: Promise<Record<string, number>> | null = null;

async function loadStats(): Promise<Record<string, number>> {
  const result = await pool.query(
    `SELECT county, COUNT(*) as count
     FROM parcels
     WHERE county IS NOT NULL
     GROUP BY county`
  );
  const stats: Record<string, number> = {};
  for (const row of result.rows) {
    if (row.county) stats[row.county] = parseInt(row.count, 10);
  }
  return stats;
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cache || now - cache.at > TTL_MS) {
      // Collapse concurrent cache misses into a single query.
      inflight ??= loadStats().finally(() => {
        inflight = null;
      });
      cache = { at: now, stats: await inflight };
    }

    return NextResponse.json(cache.stats, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (error) {
    console.error('Failed to fetch parcel stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
