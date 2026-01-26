import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { searchSchema } from '@/lib/validation';
import { z } from 'zod';
import { getEntitlements } from '@/lib/entitlements';

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
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // console.log('Using dummy user for debug');
    }

    const rawBody = await request.json();
    console.log('[SPATIAL] Request received at:', new Date().toISOString());
    
    const body = searchSchema.parse(rawBody);
    
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
      limit = 500 // Reduced default for performance
    } = body;

    const values: any[] = [];
    const conditions: string[] = ['1=1'];
    let valIdx = 1;

    // ============================================================
    // FILTER: Parcel ID (High Priority)
    // NOTE: Uses parcelno column
    // ============================================================
    if (parcelId && parcelId.trim().length > 0) {
      conditions.push(`p.parcelno ILIKE $${valIdx}`);
      values.push(`%${parcelId.trim()}%`);
      valIdx++;
      console.log('[SPATIAL] Searching by parcelno:', parcelId);
    } else {
      // ============================================================
      // FILTER: Land Use
      // ============================================================
      if (landUse && landUse.length > 0) {
        conditions.push(`p.dor_uc = ANY($${valIdx})`);
        values.push(landUse);
        valIdx++;
      }

      // ============================================================
      // FILTER: Acreage
      // ============================================================
      if (acreageMin !== undefined && acreageMax !== undefined) {
        conditions.push(`p.acreage BETWEEN $${valIdx} AND $${valIdx + 1}`);
        values.push(acreageMin, acreageMax);
        valIdx += 2;
      }

      // ============================================================
      // FILTER: Market Value
      // ============================================================
      if (marketValueMin !== undefined && marketValueMax !== undefined) {
        conditions.push(`
          CAST(
            NULLIF(REGEXP_REPLACE(COALESCE(CAST(p.jv AS TEXT), '0'), '[^0-9.]', '', 'g'), '')
          AS NUMERIC) BETWEEN $${valIdx} AND $${valIdx + 1}
        `);
        values.push(marketValueMin, marketValueMax);
        valIdx += 2;
      }

      // ============================================================
      // FILTER: SPATIAL - THE CRITICAL FIX
      // Uses p.geom (which exists) with PostGIS functions
      // ============================================================
      let hasSpatialFilter = false;
      
      if (spatialShape && typeof spatialShape === 'object' && Object.keys(spatialShape).length > 0) {
        const geom = spatialShape.geometry || spatialShape;
        
        console.log('[SPATIAL] Shape type:', geom?.type);
        console.log('[SPATIAL] Coordinates:', geom?.coordinates?.[0]?.length, 'points');
        
        if (geom && geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]?.length >= 4) {
          hasSpatialFilter = true;
          
          // CRITICAL: Use ST_PointOnSurface(p.geom) - ensures point is INSIDE the parcel
          // ST_ForcePolygonCCW - ensures correct winding order for containment test
          conditions.push(`
            ST_Within(
              ST_PointOnSurface(p.geom),
              ST_ForcePolygonCCW(
                ST_SetSRID(ST_GeomFromGeoJSON($${valIdx}), 4326)
              )
            )
          `);
          values.push(JSON.stringify(geom));
          valIdx++;
          
          // Bounding box optimization - uses GIST index
          const coords = geom.coordinates[0];
          const lons = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const bboxMinLon = Math.min(...lons);
          const bboxMaxLon = Math.max(...lons);
          const bboxMinLat = Math.min(...lats);
          const bboxMaxLat = Math.max(...lats);
          
          conditions.push(`
            p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)
          `);
          values.push(bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat);
          valIdx += 4;
          
          console.log('[SPATIAL] Polygon filter with bbox:', { bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat });
          
        } else if (spatialShape.properties?.subType === 'Circle' && spatialShape.properties?.radius) {
          hasSpatialFilter = true;
          
          const center = spatialShape.geometry?.coordinates;
          const radiusMiles = spatialShape.properties.radius;
          const radiusMeters = radiusMiles * 1609.34;
          
          conditions.push(`
            ST_DWithin(
              ST_PointOnSurface(p.geom)::geography,
              ST_SetSRID(ST_MakePoint($${valIdx}, $${valIdx + 1}), 4326)::geography,
              $${valIdx + 2}
            )
          `);
          values.push(center[0], center[1], radiusMeters);
          valIdx += 3;
          
          console.log('[SPATIAL] Circle filter, radius:', radiusMiles, 'miles');
        }
      }
      
      // Bounding box only (no polygon)
      if (!hasSpatialFilter && minLat && maxLat && minLon && maxLon) {
        conditions.push(`
          p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)
        `);
        values.push(minLon, minLat, maxLon, maxLat);
        valIdx += 4;
        console.log('[SPATIAL] Bounding box filter applied');
      }

      // ============================================================
      // FILTER: Owner Type
      // ============================================================
      if (ownerType === 'in_state') {
        conditions.push(`(p.own_state = 'FL' OR p.own_state IS NULL)`);
        // conditions.push(`p.out_of_state = false`); // Column missing, logic covered by own_state
      } else if (ownerType === 'out_of_state') {
        // conditions.push(`p.out_of_state = true`); // Column missing
        conditions.push(`(p.own_state != 'FL' AND p.own_state IS NOT NULL)`);
      }

      // ============================================================
      // OPTIONAL: Distance to Highway
      // Requires pre-calculated column 'distance_to_highway' or real-time ST_Distance check against highways table
      if (maxDistance && maxDistance > 0) {
        conditions.push(`p.distance_to_highway <= $${valIdx}`);
        values.push(maxDistance);
        valIdx++;
      }
    }

    // ============================================================
    // FILTER: Counties (Required)
    // ============================================================
    // ============================================================
    // FILTER: Counties (Required & Enforced)
    // ============================================================
    
    // 1. Get User Entitlements
    const entitlements = await getEntitlements(userId);
    const allowedCounties = entitlements.counties;
    let finalCounties: string[] = [];

    // 2. Resolve Requested vs Allowed
    if (counties && counties.length > 0) {
        // User requested specific counties. Validate they are allowed.
        if (allowedCounties === 'all') {
            finalCounties = counties;
        } else {
            // Filter requested to only allowed
            finalCounties = counties.filter(c => 
                allowedCounties.some(ac => ac.replace(' County', '') === c.replace(' County', ''))
            );
        }
    } else {
        // User requested "All", so give them all they are allowed to see
        if (allowedCounties === 'all') {
            // If Local/Regional, they can see everything. However, searching "All Florida" is terrible for performance.
            // We'll require at least one county OR limit strictness?
            // Existing logic required counties. Let's keep it required or default to Empty if too many.
            // Actually, for "All", we might just NOT filter by county?
            // BUT existing code says "No counties selected, returning empty".
            // So we must rely on user input.
             console.log('[SPATIAL] No counties selected by user, returning empty');
             return NextResponse.json({
                geojson: { type: 'FeatureCollection', features: [] },
                list: [],
                count: 0
             });
        } else {
            // If Free/Scout, default to their ONE allowed county
            finalCounties = allowedCounties;
        }
    }

    if (finalCounties.length > 0) {
      conditions.push(`p.county = ANY($${valIdx})`);
      values.push(finalCounties);
      valIdx++;
    } else {
       // If intersection resulted in empty (e.g. requested 'Baker' but only allowed 'Clay'), return empty.
       return NextResponse.json({
         geojson: { type: 'FeatureCollection', features: [] },
         list: [],
         count: 0
       });
    }

      // console.log('[SPATIAL] DEBUG Conditions:', conditions);
      // console.log('[SPATIAL] DEBUG Values:', values);

      // ============================================================
      // BUILD QUERY
      // ============================================================
    const sql = `
      WITH user_context AS (
        SELECT id, role FROM users WHERE clerk_id = $${valIdx}
      )
      SELECT 
        p.gid as id,
        p.county as county,
        p.parcelno as parcel_id,
        p.own_name as owner_name,
        p.own_addr1 as owner_address,
        p.own_city as owner_city,
        p.own_state as owner_state,
        p.own_zipcd as owner_zip,
        p.acreage as acreage,
        p.dor_uc as land_use,
        p.phy_addr1 as property_address,
        p.jv as market_value,
        CASE 
          WHEN p.own_state != 'FL' AND p.own_state IS NOT NULL THEN true 
          ELSE false 
        END as out_of_state,
        ST_Y(ST_Centroid(p.geom)) as latitude,
        ST_X(ST_Centroid(p.geom)) as longitude,
        ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson,
        CASE WHEN l.id IS NOT NULL THEN true ELSE false END as is_lead,
        EXISTS (
          SELECT 1 FROM user_parcel_notes n 
          JOIN user_context u ON 1=1
          WHERE n.parcel_id = p.parcelno 
          AND (
            n.user_id = u.id
            OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin'))
          )
        ) as has_note,
        (
          SELECT content FROM user_parcel_notes n 
          JOIN user_context u ON 1=1
          WHERE n.parcel_id = p.parcelno 
          AND (
            n.user_id = u.id
            OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin'))
          )
          ORDER BY n.created_at DESC
          LIMIT 1
        ) as note_content
      FROM parcels p
      LEFT JOIN leads l ON p.parcelno = l.parcel_id
      WHERE ${conditions.join(' AND ')}
      LIMIT $${valIdx + 1}
    `;

    values.push(userId || 'anonymous');
    values.push(limit);

    console.log('[SPATIAL] Executing query with', conditions.length, 'conditions');
    console.log('[SPATIAL] Conditions:', conditions.join(' AND '));

    // ============================================================
    // EXECUTE QUERY
    // ============================================================
    const client = await pool.connect();
    try {
      const res = await client.query(sql, values);
      const queryTime = Date.now() - startTime;
      
      console.log('[SPATIAL] Query returned', res.rows.length, 'results in', queryTime, 'ms');

      if (res.rows.length === 0) {
        return NextResponse.json({
          geojson: { type: 'FeatureCollection', features: [] },
          list: [],
          count: 0
        });
      }

      // Transform for Frontend
      const geojson = {
        type: 'FeatureCollection',
        features: res.rows.map(row => {
          let geometry;
          try {
            geometry = row.geojson ? JSON.parse(row.geojson) : { 
              type: 'Point', 
              coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)] 
            };
          } catch (e) {
            geometry = { type: 'Point', coordinates: [row.longitude, row.latitude] };
          }
          
          return {
            type: 'Feature',
            geometry,
            properties: {
              id: row.id,
              parcel_id: row.parcel_id,
              county: row.county,
              owner_name: row.owner_name,
              owner_address: row.owner_address,
              owner_city: row.owner_city,
              owner_state: row.owner_state,
              owner_zip: row.owner_zip,
              property_address: row.property_address,
              land_use: row.land_use,
              market_value: row.market_value,
              acreage: row.acreage,
              out_of_state: row.out_of_state,
              is_lead: row.is_lead,
              has_note: row.has_note,
              notes: row.note_content, // Inject note for Edit Modal
              latitude: row.latitude,
              longitude: row.longitude
            }
          };
        })
      };

      return NextResponse.json({
        geojson,
        list: res.rows,
        count: res.rows.length
      });
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('[SPATIAL] ERROR:', error.message);
    console.error('[SPATIAL] Stack:', error.stack);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid Input', details: error.issues }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: error.message 
    }, { status: 500 });
  }
}
