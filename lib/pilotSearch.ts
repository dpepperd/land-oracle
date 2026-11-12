// Pilot-state search (admin-only), shared by North Carolina and Texas. A separate code path on purpose: Florida's search route only dispatches here
// when the request says state = 'NC' or 'TX', so Florida queries are unchanged. Reads the state's view (same column names as Florida's view).
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import pool from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { absenteeSqlFor, addSellerSignalConditions } from '@/lib/sellerSignals';
import type { searchSchema } from '@/lib/validation';

type SearchBody = z.infer<typeof searchSchema>;

/** What differs between pilot states. */
export interface PilotConfig {
  state: 'NC' | 'TX';
  /** Full state name, for messages. */
  label: string;
  /** The state's search view. A fixed string from our own config, never user input. */
  view: string;
  countyCode: (name: string) => number | null;
  credit: string;
  /** Does the roll carry a sale date? Texas does not, so the no-sale filter is ignored there. */
  hasSaleDate: boolean;
}

const EMPTY = { geojson: { type: 'FeatureCollection', features: [] }, list: [], count: 0 };

export async function searchPilot(cfg: PilotConfig, body: SearchBody, userId: string): Promise<NextResponse> {
  // Pilot gate: admins only until this state is opened to plans.
  let isAdmin = false;
  try { isAdmin = (await getEntitlements(userId)).isAdmin; } catch { isAdmin = false; }
  if (!isAdmin) return NextResponse.json({ error: 'state_not_available', message: `${cfg.label} is not available yet.` }, { status: 403 });

  const { counties, acreageMin, acreageMax, marketValueMin, marketValueMax, minLat, maxLat, minLon, maxLon, spatialShape, ownerType,
    absentee, noSaleYears, vacantOnly, parcelId, address, limit = 500 } = body as SearchBody & { vacantOnly?: boolean };

  const values: any[] = [];
  const conditions: string[] = ['1=1'];
  let valIdx = 1;
  const text = parcelId && parcelId.trim() ? { kind: 'id' as const, value: parcelId.trim() } : address && address.trim() ? { kind: 'address' as const, value: address.trim() } : null;

  // Counties (the state's FIPS codes). Unknown names are ignored; if the user picked counties but none are valid, there is nothing to search.
  let coNos: number[] = [];
  if (counties && counties.length > 0) {
    coNos = counties.map((c) => cfg.countyCode(c)).filter((n): n is number => n !== null);
    if (coNos.length === 0) return NextResponse.json(EMPTY);
  }

  if (text) {
    if (coNos.length === 0) return NextResponse.json({ error: 'county_required', message: 'Pick a county first to search by parcel ID or address.' }, { status: 400 });
    conditions.push(text.kind === 'id'
      ? `(p.parcel_id ILIKE $${valIdx} OR p.alt_key ILIKE $${valIdx})`
      : `(p.phy_addr1 ILIKE $${valIdx} OR p.own_addr1 ILIKE $${valIdx})`);
    values.push(`%${text.value}%`);
    valIdx++;
  } else {
    if (vacantOnly) conditions.push('p.likely_vacant');
    if (acreageMin !== undefined) { conditions.push(`p.acreage >= $${valIdx}`); values.push(acreageMin); valIdx++; }
    if (acreageMax !== undefined) { conditions.push(`p.acreage <= $${valIdx}`); values.push(acreageMax); valIdx++; }
    if (marketValueMin !== undefined) { conditions.push(`p.jv >= $${valIdx}`); values.push(marketValueMin); valIdx++; }
    if (marketValueMax !== undefined) { conditions.push(`p.jv <= $${valIdx}`); values.push(marketValueMax); valIdx++; }

    // Drawn area (polygon, or circle) or bounding box
    let hasSpatial = false;
    if (spatialShape && typeof spatialShape === 'object' && Object.keys(spatialShape).length > 0) {
      const geom = (spatialShape as any).geometry || spatialShape;
      if (geom && geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]?.length >= 4) {
        hasSpatial = true;
        conditions.push(`ST_Within(ST_PointOnSurface(p.geom), ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON($${valIdx}), 4326)))`);
        values.push(JSON.stringify(geom));
        valIdx++;
        const lons = geom.coordinates[0].map((c: any) => c[0]);
        const lats = geom.coordinates[0].map((c: any) => c[1]);
        conditions.push(`p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)`);
        values.push(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));
        valIdx += 4;
      } else if ((spatialShape as any).properties?.subType === 'Circle' && (spatialShape as any).properties?.radius) {
        hasSpatial = true;
        const center = (spatialShape as any).geometry?.coordinates;
        conditions.push(`ST_DWithin(ST_PointOnSurface(p.geom)::geography, ST_SetSRID(ST_MakePoint($${valIdx}, $${valIdx + 1}), 4326)::geography, $${valIdx + 2})`);
        values.push(center[0], center[1], (spatialShape as any).properties.radius * 1609.34);
        valIdx += 3;
      }
    }
    if (!hasSpatial && minLat && maxLat && minLon && maxLon) {
      conditions.push(`p.geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)`);
      values.push(minLon, minLat, maxLon, maxLat);
      valIdx += 4;
    }

    if (ownerType === 'in_state') conditions.push(`(p.own_state = '${cfg.state}' OR p.own_state IS NULL)`);
    else if (ownerType === 'out_of_state') conditions.push(`(p.own_state != '${cfg.state}' AND p.own_state IS NOT NULL)`);

    if (absentee) conditions.push(absenteeSqlFor(cfg.state));
    // No homestead data in NC, so "not a homestead" is not offered. "No sale in N years" works on the sale date (present on about 38% of parcels).
    valIdx = addSellerSignalConditions({ noSaleYears: cfg.hasSaleDate ? noSaleYears : undefined }, conditions, values, valIdx);
  }

  if (coNos.length > 0) {
    conditions.push(`p.co_no = ANY($${valIdx})`);
    values.push(coNos);
    valIdx++;
  } else if (conditions.length <= 1) {
    return NextResponse.json(EMPTY); // no county, no area, no filter: nothing sensible to return (same rule as Florida)
  }

  const sql = `
    WITH user_context AS (SELECT id, role FROM users WHERE clerk_id = $${valIdx})
    SELECT
      p.parcel_key as id, p.parcel_key, p.state, p.co_no, p.county, p.parcel_id, p.parcelno, p.alt_key,
      p.own_name as owner_name, p.own_addr1 as owner_address, p.own_city as owner_city, p.own_state as owner_state, p.own_zipcd as owner_zip,
      p.acreage, p.acreage_source, p.dor_uc as land_use, p.use_desc, p.likely_vacant, COALESCE(p.phy_addr1, p.own_addr1) as property_address,
      p.jv as market_value, p.land_value, p.improvement_value,
      p.sale_prc1, p.sale1_date, p.sale_prc2, p.sale2_date, p.sale_prc3, p.sale3_date, p.living_area_sqft, p.year_built,
      (p.own_state != '${cfg.state}' AND p.own_state IS NOT NULL) as out_of_state,
      (p.has_geom IS TRUE) as has_outline,
      p.latitude as latitude, p.longitude as longitude, p.latitude as flood_lat, p.longitude as flood_lon,
      ST_AsGeoJSON(ST_Simplify(p.geom, 0.00001)) as geojson,
      ${absenteeSqlFor(cfg.state)} as is_absentee,
      (l.id IS NOT NULL) as is_lead,
      EXISTS (SELECT 1 FROM user_parcel_notes n JOIN user_context u ON 1=1 WHERE n.parcel_key = p.parcel_key AND (n.user_id = u.id OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin')))) as has_note,
      (SELECT content FROM user_parcel_notes n JOIN user_context u ON 1=1 WHERE n.parcel_key = p.parcel_key AND (n.user_id = u.id OR (u.role = 'admin' AND n.user_id IN (SELECT id FROM users WHERE role = 'admin'))) ORDER BY n.created_at DESC LIMIT 1) as note_content
    FROM ${cfg.view} p
    LEFT JOIN leads l ON l.parcel_key = p.parcel_key AND l.user_id = (SELECT id FROM user_context)
    WHERE ${conditions.join(' AND ')}
    LIMIT $${valIdx + 1}
  `;
  values.push(userId, limit);

  const client = await pool.connect();
  try {
    const res = await client.query(sql, values);
    if (res.rows.length === 0) return NextResponse.json(EMPTY);
    const features = res.rows.filter((row: any) => row.geojson || (row.latitude && row.longitude)).map((row: any) => {
      let geometry: any = null;
      try { geometry = row.geojson && row.geojson !== 'null' ? JSON.parse(row.geojson) : null; } catch { geometry = null; }
      if (!geometry && row.latitude && row.longitude) geometry = { type: 'Point', coordinates: [row.longitude, row.latitude] };
      return { type: 'Feature', geometry, properties: { ...row, notes: row.note_content } };
    });
    return NextResponse.json({ geojson: { type: 'FeatureCollection', features }, list: res.rows, count: res.rows.length, state: cfg.state, credit: cfg.credit });
  } finally {
    client.release();
  }
}
