// Returns the dashboard's usual { geojson, list, count } for a set of parcel_keys the AI assistant found,
// so they can be shown in the normal results list and on the map. Entitlement is enforced per county here.
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { AccessError, canReadCounty, resolveAccess } from '@/lib/parcels/access';
import { countyName, parseParcelKey } from '@/lib/parcels/key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ keys: z.array(z.string().min(5).max(80)).min(1).max(60) });

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

  // Keep only well-formed keys in counties this user may read.
  const keys: string[] = [];
  const counties = new Set<string>();
  for (const k of parsed.keys) {
    const p = parseParcelKey(k);
    if (!p || !countyName(p.coNo, p.state) || !canReadCounty(access, p.county)) continue;
    keys.push(`${p.state}-${p.coNo}-${p.id.toUpperCase()}`);
    counties.add(p.county);
  }
  if (keys.length === 0) return NextResponse.json({ geojson: { type: 'FeatureCollection', features: [] }, list: [], count: 0 });

  const client = await pool.connect();
  try {
    const res = await client.query(
      `WITH user_context AS (SELECT id, role FROM users WHERE clerk_id = $2)
       SELECT
         p.parcel_key as id, p.parcel_key, p.county, COALESCE(p.parcel_id, p.parcelno) as parcel_id, p.parcelno, p.alt_key,
         p.own_name as owner_name, p.own_addr1 as owner_address, p.own_city as owner_city, p.own_state as owner_state, p.own_zipcd as owner_zip,
         p.acreage, p.dor_uc as land_use, COALESCE(p.phy_addr1, p.own_addr1) as property_address, p.jv as market_value,
         p.sale_prc1, p.sale1_date, p.sale_prc2, p.sale2_date, p.sale_prc3, p.sale3_date, p.living_area_sqft, p.year_built,
         (p.own_state != 'FL' AND p.own_state IS NOT NULL) as out_of_state,
         ST_Y(ST_Centroid(p.geom)) as latitude, ST_X(ST_Centroid(p.geom)) as longitude,
         ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson,
         (l.id IS NOT NULL) as is_lead
       FROM parcels_current_all p
       LEFT JOIN leads l ON l.parcel_key = p.parcel_key AND l.user_id = (SELECT id FROM user_context)
       WHERE p.county = ANY($3) AND p.parcel_key = ANY($1)   -- county first: parcel_key is computed in the view, so the county index does the narrowing
       LIMIT 60`,
      [keys, userId, [...counties]],
    );
    const features = res.rows
      .filter((r) => r.geojson || (r.latitude && r.longitude))
      .map((r) => {
        let geometry = null;
        try { geometry = r.geojson && r.geojson !== 'null' ? JSON.parse(r.geojson) : null; } catch { geometry = null; }
        if (!geometry && r.latitude && r.longitude) geometry = { type: 'Point', coordinates: [r.longitude, r.latitude] };
        return { type: 'Feature', geometry, properties: { ...r } };
      });
    return NextResponse.json({ geojson: { type: 'FeatureCollection', features }, list: res.rows, count: res.rows.length }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[assistant/parcels]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not load parcels' }, { status: 500 });
  } finally {
    client.release();
  }
}
