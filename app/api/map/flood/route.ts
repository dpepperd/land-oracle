import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// Cap the viewport so one request can't ask for the whole state.
// 3 degrees (~330 km) is roughly zoom >= 9 on a wide screen.
const MAX_SPAN_DEG = 3;

type Bounds =
  | { ok: true; minLat: number; maxLat: number; minLon: number; maxLon: number }
  | { ok: false; error: string };

function parseBounds(sp: URLSearchParams): Bounds {
  const keys = ['minLat', 'maxLat', 'minLon', 'maxLon'] as const;
  const v: Record<string, number> = {};
  for (const k of keys) {
    const raw = sp.get(k);
    if (raw === null || raw.trim() === '') return { ok: false, error: 'Missing bounds' };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `Invalid ${k}` };
    v[k] = n;
  }
  if (v.minLat >= v.maxLat || v.minLon >= v.maxLon) return { ok: false, error: 'Invalid bounds order' };
  if (v.minLat < -90 || v.maxLat > 90 || v.minLon < -180 || v.maxLon > 180) {
    return { ok: false, error: 'Bounds out of range' };
  }
  if (v.maxLat - v.minLat > MAX_SPAN_DEG || v.maxLon - v.minLon > MAX_SPAN_DEG) {
    return { ok: false, error: `Bounds too large (max ${MAX_SPAN_DEG} degrees); zoom in` };
  }
  return { ok: true, minLat: v.minLat, maxLat: v.maxLat, minLon: v.minLon, maxLon: v.maxLon };
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const bounds = parseBounds(searchParams);
  if (!bounds.ok) {
    return NextResponse.json({ error: bounds.error }, { status: 400 });
  }
  const { minLat, maxLat, minLon, maxLon } = bounds;

  const client = await pool.connect();
  try {
    const query = `
      SELECT
        DFIRM_ID,
        COUNTY,
        FLD_ZONE,
        ZONE_SUBTY,
        SFHA_TF,
        STATIC_BFE,
        DEPTH,
        VELOCITY,
        ST_AsGeoJSON(geometry) as geojson
      FROM public.v_flood_hazard_map
      WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT 1000;
    `;

    const values = [minLon, minLat, maxLon, maxLat];
    
    // Debug log for first verification
    // console.log(`[FLOOD] Querying bounds: ${values.join(',')}`);

    const res = await client.query(query, values);

    const geojson = {
      type: 'FeatureCollection',
      features: res.rows.map(row => ({
        type: 'Feature',
        geometry: JSON.parse(row.geojson),
        properties: {
            dfirm_id: row.dfirm_id,
            county: row.county,
            fld_zone: row.fld_zone,
            zone_subty: row.zone_subty,
            sfha_tf: row.sfha_tf,
            static_bfe: row.static_bfe,
            depth: row.depth,
            velocity: row.velocity
        }
      }))
    };

    return NextResponse.json(geojson);
  } catch (error: any) {
    console.error('[FLOOD] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
