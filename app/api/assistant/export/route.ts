// CSV export of the exact parcels the AI Analyst put on the dashboard (a list of parcel_keys), not a filter search.
// Same columns, county entitlement and monthly export limit as /api/parcels/export.
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { AccessError, canReadCounty, resolveAccess } from '@/lib/parcels/access';
import { countyName, parseParcelKey } from '@/lib/parcels/key';
import { getEntitlements, trackExport } from '@/lib/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ keys: z.array(z.string().min(5).max(80)).min(1).max(60) });
const MAX_ROWS = 60;

function toCSV(data: any[]) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => {
    const val = row[h];
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let parsed;
  try { parsed = body.parse(await req.json()); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  let access;
  try { access = await resolveAccess(userId); } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  // Export limit (same rule and message as the filter export)
  let ent;
  try { ent = await getEntitlements(userId); } catch { return NextResponse.json({ error: 'Account not found' }, { status: 403 }); }
  let remaining: number | 'unlimited' = 'unlimited';
  if (ent.exports.limit !== 'unlimited') {
    if (ent.exports.used >= ent.exports.limit) {
      return NextResponse.json({
        error: 'export_cap_reached', upgrade: true, upgradeTo: ent.tier === 'scout' ? 'pro' : 'statewide',
        message: `You've used all ${ent.exports.limit.toLocaleString()} exported rows for this month on your ${ent.tier} plan. Upgrade to Pro for unlimited exports.`,
        cap: ent.exports.limit, used: ent.exports.used,
      }, { status: 402 });
    }
    remaining = (ent.exports.limit as number) - ent.exports.used;
  }

  // Keep only well-formed keys in counties this user may read (same check as /api/assistant/parcels)
  const keys: string[] = [];
  const counties = new Set<string>();
  for (const k of parsed.keys) {
    const p = parseParcelKey(k);
    if (!p || !countyName(p.coNo, p.state) || !canReadCounty(access, p.county)) continue;
    keys.push(`${p.state}-${p.coNo}-${p.id.toUpperCase()}`);
    counties.add(p.county);
  }
  if (keys.length === 0) return new NextResponse('', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="ai_parcels_export_${Date.now()}.csv"` } });

  const limit = remaining === 'unlimited' ? MAX_ROWS : Math.min(remaining, MAX_ROWS);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
         p.county,
         p.parcel_key,
         COALESCE(p.parcel_id, p.parcelno) as parcel_id,
         p.alt_key,
         p.own_name as owner_name,
         p.own_addr1 as owner_address,
         p.own_city as owner_city,
         p.own_state as owner_state,
         p.own_zipcd as owner_zip,
         p.acreage,
         p.dor_uc as land_use,
         COALESCE(p.phy_addr1, p.own_addr1) as property_address,
         p.jv as market_value,
         p.sale_prc1 as last_sale_price, to_char(p.sale1_date, 'YYYY-MM') as last_sale_date,
         p.sale_prc2 as prior_sale_price, to_char(p.sale2_date, 'YYYY-MM') as prior_sale_date,
         ST_Y(ST_Centroid(p.geom)) as latitude,
         ST_X(ST_Centroid(p.geom)) as longitude
       FROM parcels_current_all p
       WHERE p.county = ANY($2) AND p.parcel_key = ANY($1)
       LIMIT $3`,
      [keys, [...counties], limit],
    );

    if (res.rows.length > 0) {
      const tr = await trackExport(userId, res.rows.length);
      if (!tr.allowed) {
        return NextResponse.json({ error: 'export_cap_reached', upgrade: true, upgradeTo: 'pro', message: 'Monthly export limit reached. Upgrade to Pro for unlimited exports.' }, { status: 402 });
      }
    }

    return new NextResponse(toCSV(res.rows), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="ai_parcels_export_${new Date().toISOString().split('T')[0]}.csv"` },
    });
  } catch (e) {
    console.error('[assistant/export]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
