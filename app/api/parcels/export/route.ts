import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { exportSchema } from '@/lib/validation';
import { z } from 'zod';

// Helper to convert array of objects to CSV string
function toCSV(data: any[]) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const val = row[header];
      // Handle commas and quotes in data
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const body = exportSchema.parse(rawBody);

     const { 
      counties, 
      landUse,
      acreageMin, 
      acreageMax, 
      maxDistance, 
      ownerType
    } = body;

    const values: any[] = [];
    const conditions: string[] = ['1=1'];
    let valIdx = 1;

    // 1. Get Entitlements
    const { getEntitlements, trackExport } = await import('@/lib/entitlements');
    const ent = await getEntitlements(userId);
    
    // 2. Check Export Limit
    let remaining: number | 'unlimited' = 'unlimited';
    
    if (ent.exports.limit !== 'unlimited') {
        if (ent.exports.used >= ent.exports.limit) {
             return NextResponse.json({ error: 'Export Limit Reached', upgrade: true }, { status: 403 });
        }
        remaining = (ent.exports.limit as number) - ent.exports.used;
    }

    // 3. Enforce County Access
    const allowedCounties = ent.counties;
    let finalCounties: string[] = [];
    
    // Filter by Counties
    if (counties && counties.length > 0) {
       if (allowedCounties === 'all') {
            finalCounties = counties;
       } else {
            finalCounties = counties.filter(c => 
                allowedCounties.some(ac => ac.replace(' County', '') === c.replace(' County', ''))
            );
       }
    } else {
        // Default to allowed (for exports, we usually want specific counties, but if empty we export all allowed)
        if (allowedCounties !== 'all') {
            finalCounties = allowedCounties;
        }
        // If 'all', we don't add filter (so exports entire DB? Dangerous. But limited by LIMIT 5000).
    }
    
    if (finalCounties.length > 0) {
      conditions.push(`county = ANY($${valIdx})`);
      values.push(finalCounties);
      valIdx++;
    } else if (allowedCounties !== 'all') {
       // Requested something not allowed
       return NextResponse.json({ error: 'County Access Denied' }, { status: 403 });
    }

    // Filter by Land Use
    if (landUse && landUse.length > 0) {
        conditions.push(`land_use = ANY($${valIdx})`);
        values.push(landUse);
        valIdx++;
    }

    // Filter by Acreage
    if (acreageMin !== undefined && acreageMax !== undefined) {
      conditions.push(`acreage BETWEEN $${valIdx} AND $${valIdx + 1}`);
      values.push(acreageMin, acreageMax);
      valIdx += 2;
    }

    // Filter by Owner Type
    if (ownerType === 'in_state') {
        conditions.push(`(owner_state = 'FL' OR owner_state IS NULL)`); 
        conditions.push(`out_of_state = false`); 
    } else if (ownerType === 'out_of_state') {
        conditions.push(`out_of_state = true`);
    }
    
    // Distance Filter (Requires Pre-calculated column, removed PostGIS query)
    if (maxDistance && maxDistance > 0) {
       conditions.push(`distance_to_highway <= $${valIdx}`);
       values.push(maxDistance); 
       valIdx++;
    }

    const sql = `
      SELECT 
        county, 
        parcel_id, 
        owner_name, 
        owner_address, 
        owner_city, 
        owner_state, 
        owner_zip, 
        acreage,
        property_address,
        land_use,
        assessed_value,
        market_value
      FROM parcels
      WHERE ${conditions.join(' AND ')}
      LIMIT $${valIdx} -- Limit based on remaining quota
    `;

    // Add Limit to Values
    // If unlimited, cap at 5000 for safety. If limited, cap at remaining.
    const safeLimit = remaining === 'unlimited' ? 5000 : Math.min(remaining, 5000);
    values.push(safeLimit);

    const client = await pool.connect();
    try {
      const res = await client.query(sql, values);
      
      // TRACK USAGE
      if (res.rows.length > 0) {
          await trackExport(userId, res.rows.length);
      }

      const csv = toCSV(res.rows);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="parcels_export_${Date.now()}.csv"`
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid Input', details: error.errors }, { status: 400 });
    }
    console.error('Export API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}
