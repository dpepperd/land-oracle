import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { searchSchema } from '@/lib/validation';
import { z } from 'zod';
import { getEntitlements } from '@/lib/entitlements';
import { LIVE_COUNTIES, filterAllowedCounties } from '@/lib/counties';
import { countyCode, countyName } from '@/lib/parcels/key';
import { ABSENTEE_SQL, addSellerSignalConditions } from '@/lib/sellerSignals';

/**
 * ULTIMATE SPATIAL SEARCH FIX - January 2026
 * 
 * DATABASE SCHEMA GROUND TRUTH:
 * - Primary key: gid (NOT id)
 * - Parcel identifier: parcelno (NOT parcel_id)
 * - Geometry: geom column (PostGIS)
 * - NO latitude/longitude columns (compute from geom)
 * - NO centroid_geom column (use ST_PointOnSurface)
 * 
 * FIXES APPLIED:
 * 1. p.gid as id (database uses gid, not id)
 * 2. p.parcelno (not p.parcel_id)
 * 3. ST_Y/ST_X(ST_Centroid(p.geom)) for lat/lon
 * 4. ST_PointOnSurface(p.geom) for spatial filtering
 * 5. Bounding box optimization with && operator
 */

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const { userId } = await auth();
    
    // Auth Check - Critical
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    console.log('[SPATIAL] Request received at:', new Date().toISOString());
    
    const body = searchSchema.parse(rawBody);
    
    // Deconstruct body
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
      absentee, nonHomestead, noSaleYears,
      parcelId, 
      address, // New field
      limit = 500
    } = body;

    const values: any[] = [];
    const conditions: string[] = ['1=1'];
    let valIdx = 1;
    let nalText: { kind: 'id' | 'address'; value: string } | null = null;

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

      // 4. Market Value (OPTIMIZED: Direct Numeric Comparison)
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
          // Polygon containment
          conditions.push(`
            ST_Within(
              ST_PointOnSurface(p.geom),
              ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON($${valIdx}), 4326))
            )
          `);
          values.push(JSON.stringify(geom));
          valIdx++;
          
          // BBox Optimization
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

      // 6b. Seller signals (absentee / not homestead / no recent sale)
      valIdx = addSellerSignalConditions({ absentee, nonHomestead, noSaleYears }, conditions, values, valIdx);

      // 7. Highway Distance (Optional)
      if (maxDistance && maxDistance > 0) {
        conditions.push(`p.distance_to_highway <= $${valIdx}`);
        values.push(maxDistance);
        valIdx++;
      }
    }

    // 8. County Entitlements (Required)
    const entitlements = await getEntitlements(userId);
    const allowedCounties = entitlements.counties;
    let finalCounties: string[] = [];


    if (counties && counties.length > 0) {
        if (allowedCounties === 'all') finalCounties = counties;
        else finalCounties = filterAllowedCounties(counties, allowedCounties);
    } else {
        if (allowedCounties === 'all') {
             // AUTO-ACCESS: Only default to ALL LIVE counties if specific filters are applied.
             // If no filters (just '1=1'), return empty to prevent "Ghost Records" (e.g. Sarasota showing up randomly).
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
      // FIX: Case-insensitive match for County (DeSoto vs Desoto)
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
       return NextResponse.json({ geojson: { type: 'FeatureCollection', features: [] }, list: [], count: 0 });
    }

    // Build SQL
    const buildSql = (extra: string) => `
      WITH user_context AS (SELECT id, role FROM users WHERE clerk_id = $${valIdx})
      SELECT 
        p.parcel_key as id, p.parcel_key, p.county, COALESCE(p.parcel_id, p.parcelno) as parcel_id, p.parcelno, p.alt_key, 
        p.own_name as owner_name, p.own_addr1 as owner_address, p.own_city as owner_city, p.own_state as owner_state, p.own_zipcd as owner_zip, 
        p.acreage, p.dor_uc as land_use, COALESCE(p.phy_addr1, p.own_addr1) as property_address, p.jv as market_value,
        p.sale_prc1, p.sale1_date, p.sale_prc2, p.sale2_date, p.sale_prc3, p.sale3_date, p.living_area_sqft, p.year_built,
        (p.own_state != 'FL' AND p.own_state IS NOT NULL) as out_of_state,
        (p.has_geom IS TRUE) as has_outline,
        ST_Y(ST_Centroid(p.geom)) as latitude, ST_X(ST_Centroid(p.geom)) as longitude,
        ST_Y(ST_PointOnSurface(p.geom)) as flood_lat, ST_X(ST_PointOnSurface(p.geom)) as flood_lon,
        ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson,
        ${ABSENTEE_SQL} as is_absentee,
        (l.id IS NOT NULL) as is_lead,
        EXISTS (SELECT 1 FROM user_parcel_notes n JOIN user_context u ON 1=1 WHERE n.parcel_key = p.parcel_key AND (n.user_id = u.id OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin')))) as has_note,
        (SELECT content FROM user_parcel_notes n JOIN user_context u ON 1=1 WHERE n.parcel_key = p.parcel_key AND (n.user_id = u.id OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin'))) ORDER BY n.created_at DESC LIMIT 1) as note_content
      FROM parcels_current_all p
      LEFT JOIN leads l ON l.parcel_key = p.parcel_key AND l.user_id = (SELECT id FROM user_context)
      WHERE ${conditions.join(' AND ')}${extra}
      LIMIT ${valIdx + 1}
    `;

    values.push(userId, limit);

    // Execute
    const client = await pool.connect();
    try {
      // Parcels with a map outline come first, so the map is not filled with results it cannot draw. Parcels without an outline
      // (about half of some counties) still fill the rest of the list. Two bounded queries avoid sorting a huge result set.
      let rows = (await client.query(buildSql(' AND p.has_geom IS TRUE'), values)).rows;
      if (rows.length < limit) {
        const rest = [...values]; rest[rest.length - 1] = limit - rows.length;
        rows = rows.concat((await client.query(buildSql(' AND p.has_geom IS NOT TRUE'), rest)).rows);
      }
      const res = { rows };
      
      if (res.rows.length === 0) {
        return NextResponse.json({ geojson: { type: 'FeatureCollection', features: [] }, list: [], count: 0 });
      }


      const geojson = {
        type: 'FeatureCollection',
        features: res.rows.filter(row => row.geojson || (row.latitude && row.longitude)).map(row => {
          let geometry;
          try { geometry = (row.geojson && row.geojson !== 'null') ? JSON.parse(row.geojson) : null; } 
          catch (e) { geometry = null; }
          
          // Fallback if no geometry (metadata only)
          if (!geometry && row.latitude && row.longitude) {
              geometry = { type: 'Point', coordinates: [row.longitude, row.latitude] };
          }
          
          return {
            type: 'Feature', geometry,
            properties: { ...row, notes: row.note_content }
          };
        })
      };

      return NextResponse.json({ geojson, list: res.rows, count: res.rows.length });
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('[SPATIAL] ERROR:', error.message);
    if (error instanceof z.ZodError) {
        console.error('[SPATIAL] Validation Error:', JSON.stringify(error.issues, null, 2));
        return NextResponse.json({ error: 'Invalid Input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
