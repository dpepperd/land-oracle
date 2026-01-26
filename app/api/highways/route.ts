import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    // Select all highways. If dataset is huge, might need simplification or tiling,
    // but FDOT major roads is manageable (under 5MB Usually for simple lines).
    const res = await client.query('SELECT id, name, type, geojson FROM highways');
    
    const features = res.rows.map(row => {
        try {
            return {
                type: 'Feature',
                geometry: JSON.parse(row.geojson),
                properties: {
                    id: row.id,
                    name: row.name,
                    type: row.type
                }
            };
        } catch (e) { return null; }
    }).filter(f => f !== null);

    return NextResponse.json({
        type: 'FeatureCollection',
        features
    });

  } catch (error) {
    console.error('Highways Error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
