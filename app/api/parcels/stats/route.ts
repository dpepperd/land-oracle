
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Count parcels per county
    // Using simple group by. Index on county helps.
    const result = await pool.query(
      `SELECT county, COUNT(*) as count 
       FROM parcels 
       WHERE county IS NOT NULL 
       GROUP BY county`
    );

    const stats: Record<string, number> = {};
    result.rows.forEach((row: any) => {
      // Normalize county name to Title Case or lower case key
      if (row.county) {
          stats[row.county] = parseInt(row.count, 10);
      }
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch parcel stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
