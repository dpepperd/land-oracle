import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { exportSchema } from '@/lib/validation';
import { z } from 'zod';
import { LIVE_COUNTIES, filterAllowedCounties } from '@/lib/counties';
import { countyCode, countyName } from '@/lib/parcels/key';

// Helper to convert array of objects to CSV string
function toCSV(data: any[]) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const val = row[header];
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
      marketValueMin,
      marketValueMax,
      minLat, maxLat, minLon, maxLon,
      spatialShape,
      maxDistance, 
      ownerType,
      parcelId, 
      address
    } = body;

    const values: any[] = [];
    const conditions: string[] = ['1=1'];
    let valIdx = 1;
    let nalText: { kind: 'id' | 'address'; value: string } | null = null;

    // 1. Get Entitlements
    const { getEntitlements, trackExport } = await import('@/lib/entitlements');
    const ent = await getEntitlements(userId);
    
    // 2. Check Export Limit
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

    // --- IDENTICAL LOGIC TO search/route.ts ---
    // 1. Parcel ID Filter (Fastest)
    if (parcelId && parcelId.trim().length > 0) {
      nalText = { kind: 'id', value: parcelId.trim() };
    } else if (address && address.trim().length > 0) {
      // 1.5 Address Search (Specific)
      nalText = { kind: 'address', value: address.trim() };
    } else {
      // 2. Land Use
      if (landUse && landUse.length > 0) {
        conditions.push(`p.dor_uc = ANY($${valIdx})`);
        values.push(landUse);
        valIdx++;
      }

      // 3. Acreage
      if (acreageMin !== undefined) {
        conditions.push(`p.acreage >= $${valIdx}`);
        values.push(acreageMin);
        valIdx += 1;
      }
      if (acreageMax !== undefined) {
        conditions.push(`p.acreage <= $${valIdx}`);
        values.push(acreageMax);
        valIdx += 1;
      }

      // 4. Market Value
      if (marketValueMin !== undefined) {
        conditions.push(`p.jv >= $${valIdx}`);
        values.push(marketValueMin);
        valIdx += 1;
      }
      if (marketValueMax !== undefined) {
        conditions.push(`p.jv <= $${valIdx}`);
        values.push(marketValueMax);
        valIdx += 1;
      }

      // 5. Spatial Filters
      let hasSpatialFilter = false;
      if (spatialShape && typeof spatialShape === 'object' && Object.keys(spatialShape).length > 0) {
        const geom = spatialShape.geometry || spatialShape;
        if (geom && geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]?.length >= 4) {
          hasSpatialFilter = true;
          conditions.push(`
            ST_Within(
              ST_PointOnSurface(p.geom),
              ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON($${valIdx}), 4326))
            )
          `);
          values.push(JSON.stringify(geom));
          valIdx++;
          
          const coords = geom.coordinates[0];
          const lons = coords.map((c: any) => c[0]);
          const lats = coords.map((c: any) => c[1]);
          conditions.push(`p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)`);
          values.push(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));
          valIdx += 4;
        } else if (spatialShape.properties?.subType === 'Circle' && spatialShape.properties?.radius) {
          hasSpatialFilter = true;
          const center = spatialShape.geometry?.coordinates;
          const radiusMeters = spatialShape.properties.radius * 1609.34;
          conditions.push(`
            ST_DWithin(
              ST_PointOnSurface(p.geom)::geography,
              ST_SetSRID(ST_MakePoint($${valIdx}, $${valIdx + 1}), 4326)::geography,
              $${valIdx + 2}
            )
          `);
          values.push(center[0], center[1], radiusMeters);
          valIdx += 3;
        }
      }
      
      // BBox only
      if (!hasSpatialFilter && minLat && maxLat && minLon && maxLon) {
        conditions.push(`p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)`);
        values.push(minLon, minLat, maxLon, maxLat);
        valIdx += 4;
      }

      // 6. Owner Type
      if (ownerType === 'in_state') conditions.push(`(p.own_state = 'FL' OR p.own_state IS NULL)`);
      else if (ownerType === 'out_of_state') conditions.push(`(p.own_state != 'FL' AND p.own_state IS NOT NULL)`);

      // 7. Highway Distance (Optional)
      if (maxDistance && maxDistance > 0) {
        conditions.push(`p.distance_to_highway <= $${valIdx}`);
        values.push(maxDistance);
        valIdx++;
      }
    }

    // 8. County Entitlements
    const allowedCounties = ent.counties;
    let finalCounties: string[] = [];
    if (counties && counties.length > 0) {
        if (allowedCounties === 'all') finalCounties = counties;
        else finalCounties = filterAllowedCounties(counties, allowedCounties);
    } else {
        if (allowedCounties === 'all') {
             if (conditions.length > 1 || nalText) {
                 finalCounties = LIVE_COUNTIES;
             } else {
                 finalCounties = [];
             }
        } else {
            finalCounties = allowedCounties;
        }
    }

    if (finalCounties.length > 0) {
      // Exact DB spellings so the btree index on county is used (filterAllowedCounties already enforced entitlement).
      const exactNames = finalCounties.map((c) => countyName(countyCode(c) ?? -1)).filter((n): n is string => !!n);
      conditions.push(`p.county = ANY($${valIdx})`);
      values.push(exactNames);
      valIdx++;
      // Text searches run NAL-first (cheap scan by co_no) and then join to geometry; avoids scanning a whole county through the view.
      if (nalText) {
        const coNos = exactNames.map((n) => countyCode(n)).filter((n): n is number => !!n);
        const cols = nalText.kind === 'id' ? ['n.parcel_id', 'n.alt_key'] : ['n.phy_addr1', 'n.own_addr1'];
        conditions.push(`p.match_key = ANY(ARRAY(SELECT CASE WHEN n.co_no = 74 THEN upper(regexp_replace(n.alt_key, '[^A-Za-z0-9]', '', 'g')) ELSE n.match_key END FROM dor.nal_2026 n WHERE n.co_no = ANY($${valIdx}) AND (${cols.map((c) => c + ' ILIKE $' + (valIdx + 1)).join(' OR ')})))`);
        values.push(coNos, `%${nalText.value}%`);
        valIdx += 2;
      }
    } else {
        // Safe fail return empty CSV
        return new NextResponse("", {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="parcels_export_${Date.now()}.csv"`
        }
      });
    }

    const sql = `
      SELECT 
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
      WHERE ${conditions.join(' AND ')}
      LIMIT $${valIdx}
    `;

    // Add Limit to Values
    const safeLimit = remaining === 'unlimited' ? 5000 : Math.min(remaining, 5000);
    values.push(safeLimit);

    const client = await pool.connect();
    try {
      const res = await client.query(sql, values);
      
      // TRACK USAGE
      if (res.rows.length > 0) {
          const tr = await trackExport(userId, res.rows.length);
          if (!tr.allowed) {
            return NextResponse.json({ error: 'export_cap_reached', upgrade: true, upgradeTo: 'pro', message: 'Monthly export limit reached. Upgrade to Pro for unlimited exports.' }, { status: 402 });
          }
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
        return NextResponse.json({ error: 'Invalid Input', details: error.issues }, { status: 400 });
    }
    console.error('Export API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}
