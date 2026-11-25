import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Public health check for an uptime monitor (no user or parcel data). 200 = site and database are up and the key tables are readable by the app's role.
// 503 = something the product needs is broken (this is the check that would have caught "permission denied for schema dor").
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};
  const probe = async (name: string, sql: string) => {
    try { await pool.query(sql); checks[name] = true; } catch (e) { checks[name] = false; console.error(`[health] ${name} failed:`, (e as Error).message); }
  };
  await probe('database', 'SELECT 1');
  await probe('users', 'SELECT 1 FROM users LIMIT 1');
  await probe('parcels', 'SELECT 1 FROM parcels_v2 LIMIT 1');
  await probe('dor_nal', 'SELECT 1 FROM dor.nal_2026 LIMIT 1');
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
