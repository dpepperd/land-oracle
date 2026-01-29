import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  minLat: z.coerce.number(),
  maxLat: z.coerce.number(),
  minLon: z.coerce.number(),
  maxLon: z.coerce.number()
});

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = {
    minLat: searchParams.get('minLat'),
    maxLat: searchParams.get('maxLat'),
    minLon: searchParams.get('minLon'),
    maxLon: searchParams.get('maxLon')
  };

  const validation = schema.safeParse(query);
  if (!validation.success) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }

  const { minLat, maxLat, minLon, maxLon } = validation.data;
  
  const client = await pool.connect();
  try {
      const sql = `
        SELECT 
            id, roadway, aadt, truck_aadt, t_factor, year, 
            ST_AsGeoJSON(geom) as geojson
        FROM traffic_stats
        WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        LIMIT 2000
      `;
      
      const res = await client.query(sql, [minLon, minLat, maxLon, maxLat]);
      
      const geojson = {
          type: 'FeatureCollection',
          features: res.rows.map(r => ({
              type: 'Feature',
              geometry: JSON.parse(r.geojson),
              properties: {
                  id: r.id,
                  roadway: r.roadway,
                  aadt: r.aadt,
                  truck_aadt: r.truck_aadt,
                  t_factor: r.t_factor,
                  year: r.year,
                  color: getTrafficColor(r.aadt),
                  truck_color: getTruckColor(r.truck_aadt)
              }
          }))
      };
      
      return NextResponse.json(geojson);
      
  } catch (e) {
      console.error('Traffic Layer Error:', e);
      return new NextResponse("Internal Error", { status: 500 });
  } finally {
      client.release();
  }
}

function getTrafficColor(aadt: number) {
    if (aadt > 50000) return '#dc2626'; // Red-600
    if (aadt > 20000) return '#ea580c'; // Orange-600
    if (aadt > 5000) return '#ca8a04';  // Yellow-600
    return '#16a34a'; // Green-600
}

function getTruckColor(truck_aadt: number) {
    if (truck_aadt > 5000) return '#7c3aed'; // Violet-600 (High Truck)
    if (truck_aadt > 1000) return '#9333ea'; // Purple-600
    if (truck_aadt > 250) return '#c084fc';  // Purple-400
    return '#e9d5ff'; // Purple-100 (Low Truck)
}
