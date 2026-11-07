import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minLat = searchParams.get('minLat');
  const maxLat = searchParams.get('maxLat');
  const minLon = searchParams.get('minLon');
  const maxLon = searchParams.get('maxLon');

  if (!minLat || !maxLat || !minLon || !maxLon) {
    return NextResponse.json({ error: 'Missing bounds' }, { status: 400 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
