// Typed, entitlement-enforcing parcel query layer. Server-only.
// Reads ONLY parcels_current / parcels_current_all (sales are the sale1..3 columns: last 3 qualified sales) + flood_hazard/highways.
// Every function takes the Clerk userId and enforces county entitlement itself; never trust a caller-supplied county list.
import { z } from 'zod';
import pool from '@/lib/db';
import { AccessError, InputError, NotFoundError, assertCounty, resolveAccess, type Access } from './access';
import { countyCode, countyName, parseParcelKey } from './key';
import { DEFAULT_STATE, PROPERTY_TYPES, getState, type PropertyType } from './states';

export { AccessError, InputError, NotFoundError } from './access';
export { parcelKeyFor, parseParcelKey, countyCode, countyName } from './key';
export { PROPERTY_TYPES, getState, DEFAULT_STATE, SUPPORTED_STATES } from './states';

/** Sale data = the last 3 qualified (arm's-length) sales per parcel from the 2026 DOR sales file. */
export const SALES_COVERAGE_NOTE =
  'Sales data is the last 3 qualified (arm\'s-length) sales per parcel from the 2026 Florida DOR sales file, which covers only a recent window. "No sale on record" means none in that file, not that the parcel never sold.';

// ---------- helpers ----------
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const dateStr = (v: unknown): string | null => (v ? new Date(v as string).toISOString().slice(0, 7) : null); // YYYY-MM (day not published)
const yearsSince = (v: unknown): number | null => (v ? Math.round(((Date.now() - new Date(v as string).getTime()) / 31_557_600_000) * 10) / 10 : null);
const join = (...p: (string | null | undefined)[]) => p.filter((x) => x && String(x).trim()).join(', ');

async function run<T = any>(sql: string, params: unknown[], timeoutMs = 25_000): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN READ ONLY');
    await c.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`);
    const r = await c.query(sql, params);
    await c.query('COMMIT');
    return r.rows as T[];
  } catch (e: any) {
    await c.query('ROLLBACK').catch(() => {});
    if (e?.code === '57014') throw new InputError('Query took too long. Narrow the filters (add acreage/value ranges or a use code).');
    throw e;
  } finally {
    c.release();
  }
}

// ---------- searchParcels ----------
export const searchFilters = z.object({
  county: z.union([z.string().min(2).max(40), z.array(z.string().min(2).max(40)).min(1).max(5)]).optional(),
  state: z.string().length(2).default(DEFAULT_STATE),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).max(13).optional(),
  useCodes: z.array(z.string().regex(/^\d{1,3}$/)).max(20).optional(), // raw state land-use codes; prefer propertyTypes
  acreageMin: z.number().min(0).optional(),
  acreageMax: z.number().min(0).optional(),
  jvMin: z.number().min(0).optional(),
  jvMax: z.number().min(0).optional(),
  absenteeOwner: z.boolean().optional(),
  minYearsSinceLastSale: z.number().min(0).max(100).optional(),
  maxYearsSinceLastSale: z.number().min(0).max(100).optional(),
  floodZones: z.array(z.string().min(1).max(10)).max(10).optional(),
  sort: z.enum(['jv_desc', 'jv_asc', 'acreage_desc', 'acreage_asc']).default('jv_desc'),
  limit: z.number().int().min(1).max(50).default(25),
});
export type SearchFilters = z.input<typeof searchFilters>;

export interface ParcelRow {
  parcel_key: string; parcel_id: string; county: string; state: string; use_code: string | null; property_type: PropertyType | null; use_description: string | null;
  acreage: number | null; jv: number | null; situs_address: string | null;
  owner_name: string | null; mail_address: string | null; absentee: boolean;
  last_sale_date: string | null; last_sale_price: number | null; years_since_last_sale: number | null;
  lat: number | null; lon: number | null;
}
export interface SearchResult { total: number; returned: number; truncated: boolean; counties: string[]; rows: ParcelRow[]; notes: string[] }

const ABSENTEE_SQL = `nullif(btrim(c.own_addr1),'') IS NOT NULL AND nullif(btrim(c.phy_addr1),'') IS NOT NULL
                      AND upper(btrim(c.own_addr1)) <> upper(btrim(c.phy_addr1))`;

function mapRow(r: any, state: string = DEFAULT_STATE): ParcelRow {
  const prof = getState(state);
  const absentee = !!(r.own_addr1 && r.phy_addr1 && String(r.own_addr1).trim().toUpperCase() !== String(r.phy_addr1).trim().toUpperCase());
  return {
    parcel_key: r.parcel_key, parcel_id: r.parcel_id, county: r.county, state, use_code: r.use_code || null,
    property_type: prof.propertyTypeOf(r.use_code), use_description: prof.describeUseCode(r.use_code),
    acreage: num(r.acreage) === null ? null : Math.round(Number(r.acreage) * 100) / 100,
    jv: num(r.jv), situs_address: join(r.phy_addr1, r.phy_city) || null,
    owner_name: r.own_name || null,
    mail_address: join(r.own_addr1, r.own_addr2, r.own_city, r.own_state, r.own_zipcd) || null,
    absentee, last_sale_date: dateStr(r.last_sale_date), last_sale_price: num(r.last_sale_price),
    years_since_last_sale: yearsSince(r.last_sale_date), lat: num(r.latitude), lon: num(r.longitude),
  };
}

export async function searchParcels(userId: string, rawFilters: SearchFilters): Promise<SearchResult> {
  const a = await resolveAccess(userId);
  const f = searchFilters.parse(rawFilters);
  const profile = getState(f.state);

  // county resolution + entitlement
  let requested = f.county === undefined ? [] : Array.isArray(f.county) ? f.county : [f.county];
  if (requested.length === 0) {
    if (a.countyList !== 'all' && a.countyList.length > 0 && a.countyList.length <= 3) requested = a.countyList;
    else throw new InputError('A county is required.');
  }
  for (const c of requested) assertCounty(a, c);
  const counties = requested.map((c) => {
    const n = countyName(countyCode(c, f.state) ?? -1, f.state);
    if (!n) throw new InputError(`Unknown ${profile.name} county: ${c}`);
    return n; // exact DB spelling so the btree index on parcels.county is used
  });

  const where: string[] = ['c.county = ANY($1)'];
  const p: unknown[] = [counties];
  const add = (sql: string, ...vals: unknown[]) => {
    let s = sql;
    vals.forEach((v) => { p.push(v); s = s.replace('?', `$${p.length}`); });
    where.push(s);
  };
  add('c.state = ?', f.state.toUpperCase());
  const codeSet = new Set<string>((f.useCodes ?? []).map((u) => u.padStart(3, '0')));
  if (f.propertyTypes?.length) profile.useCodesFor(f.propertyTypes).forEach((u) => codeSet.add(u));
  if (codeSet.size) add('c.use_code = ANY(?)', [...codeSet]);
  if (f.acreageMin !== undefined) add('c.acreage >= ?', f.acreageMin);
  if (f.acreageMax !== undefined) add('c.acreage <= ?', f.acreageMax);
  if (f.jvMin !== undefined) add('c.jv >= ?', f.jvMin);
  if (f.jvMax !== undefined) add('c.jv <= ?', f.jvMax);
  if (f.absenteeOwner === true) where.push(`(${ABSENTEE_SQL})`);
  if (f.absenteeOwner === false) where.push(`NOT (${ABSENTEE_SQL})`);
  // "no sale in the last N years" (includes parcels with no sale on record in the available window)
  if (f.minYearsSinceLastSale !== undefined) { p.push(f.minYearsSinceLastSale); where.push(`(c.sale1_date IS NULL OR c.sale1_date <= current_date - ($${p.length}::float8 * interval '1 year'))`); }
  if (f.maxYearsSinceLastSale !== undefined) { p.push(f.maxYearsSinceLastSale); where.push(`c.sale1_date > current_date - ($${p.length}::float8 * interval '1 year')`); }
  if (f.floodZones?.length) {
    const sfha = f.floodZones.some((z) => z.toUpperCase() === 'SFHA');
    const zones = f.floodZones.filter((z) => z.toUpperCase() !== 'SFHA').map((z) => z.toUpperCase());
    p.push(zones);
    const zi = p.length;
    where.push(`EXISTS (SELECT 1 FROM flood_hazard fh WHERE fh.geom_safe && c.geom
                 AND ST_Intersects(fh.geom_safe, ST_PointOnSurface(c.geom))
                 AND (upper(fh.fld_zone) = ANY($${zi}::text[])${sfha ? " OR fh.sfha_tf = 'T'" : ''}))`);
  }
  const order = { jv_desc: 'c.jv DESC NULLS LAST', jv_asc: 'c.jv ASC NULLS LAST', acreage_desc: 'c.acreage DESC NULLS LAST', acreage_asc: 'c.acreage ASC NULLS LAST' }[f.sort];
  const W = where.join('\n AND ');

  const [countRows, rows] = await Promise.all([
    run(`SELECT count(*)::int AS n FROM parcels_current c WHERE ${W}`, p),
    run(
      `SELECT c.co_no, c.match_key, c.parcel_key, c.parcel_id, c.county, c.use_code, c.acreage, c.jv, c.own_name, c.own_addr1, c.own_addr2,
              c.own_city, c.own_state, c.own_zipcd, c.phy_addr1, c.phy_city, c.latitude, c.longitude,
              c.sale1_date AS last_sale_date, c.sale_prc1 AS last_sale_price
         FROM parcels_current c WHERE ${W} ORDER BY ${order} LIMIT ${f.limit}`,
      p,
    ),
  ]);
  const total = countRows[0]?.n ?? 0;
  const notes: string[] = [];
  if (f.minYearsSinceLastSale !== undefined || f.maxYearsSinceLastSale !== undefined) notes.push(SALES_COVERAGE_NOTE);
  if (total > f.limit) notes.push(`Showing ${f.limit} of ${total}. Narrow the filters or change the sort to see others.`);
  return { total, returned: rows.length, truncated: total > rows.length, counties: requested, rows: rows.map((r) => mapRow(r, f.state)), notes };
}

// ---------- getParcel ----------
async function loadSubject(a: Access, parcelKey: string) {
  const k = parseParcelKey(parcelKey);
  if (!k) throw new InputError('Invalid parcel_key. Expected "<STATE>-<2-digit county number>-<parcel id>", e.g. "FL-20-...".');
  assertCounty(a, k.county);
  const key = `${k.state}-${k.coNo}-${k.id.toUpperCase()}`;
  const rows = await run(
    `SELECT * FROM parcels_current_all c WHERE c.state = $3 AND c.county = $1 AND c.parcel_key = $2 ORDER BY c.gid LIMIT 1`,
    [k.county, key, k.state],
  );
  if (!rows[0]) throw new NotFoundError(`No parcel found for ${parcelKey}`);
  return rows[0];
}

function needGeometry(s: any) {
  if (!s.has_geom) throw new InputError('This parcel has no map geometry yet (new 2026 parcel), so comps and flood/highway context are unavailable.');
}

export interface ParcelDetail extends ParcelRow {
  land_value: number | null; year_built: number | null; living_area_sqft: number | null;
  homestead: boolean | null;
  sales: { sale_date: string | null; price: number | null }[];
  notes: string[];
}

export async function getParcel(userId: string, parcelKey: string): Promise<ParcelDetail> {
  const a = await resolveAccess(userId);
  const r = await loadSubject(a, parcelKey);
  const sales = [1, 2, 3]
    .map((i) => ({ sale_date: dateStr(r[`sale${i}_date`]), price: num(r[`sale_prc${i}`]) }))
    .filter((x) => x.sale_date || x.price);
  const base = mapRow({ ...r, last_sale_date: r.sale1_date, last_sale_price: r.sale_prc1 }, r.state);
  return {
    ...base,
    land_value: num(r.land_value), year_built: num(r.year_built) || null, living_area_sqft: num(r.living_area_sqft) || null,
    homestead: r.homestead === null || r.homestead === undefined ? null : !!r.homestead,
    sales,
    notes: [SALES_COVERAGE_NOTE, ...getState(r.state).dataNotes],
  };
}

// ---------- getComps ----------
export const compsSchema = z.object({
  radiusMiles: z.number().min(0.1).max(5).default(1),
  months: z.number().int().min(1).max(60).default(24),
});
export interface CompRow {
  parcel_key: string; parcel_id: string; situs_address: string | null; distance_miles: number; sale_date: string | null; sale_price: number;
  acreage: number | null; living_area_sqft: number | null; price_per_acre: number | null; price_per_sqft: number | null;
}
export interface CompsResult {
  subject: { parcel_key: string; use_code: string | null; acreage: number | null; living_area_sqft: number | null; jv: number | null };
  radius_miles: number; months: number; count: number; returned: number; median_price: number | null; median_price_per_acre: number | null; median_price_per_sqft: number | null;
  comps: CompRow[]; notes: string[];
}
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((x, y) => x - y); const m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };

export async function getComps(userId: string, parcelKey: string, opts: z.input<typeof compsSchema> = {}): Promise<CompsResult> {
  const a = await resolveAccess(userId);
  const o = compsSchema.parse(opts);
  const s = await loadSubject(a, parcelKey);   // also enforces county entitlement; comps stay inside the subject's county
  needGeometry(s);
  const meters = o.radiusMiles * 1609.344;
  const deg = (o.radiusMiles / 50) + 0.002;
  const rows = await run(
    `WITH subj AS (SELECT geom, ST_PointOnSurface(geom) AS pt FROM parcels_current WHERE gid = $1 AND county = $2 LIMIT 1),
          cand AS (SELECT c.parcel_key, c.parcel_id, c.phy_addr1, c.phy_city, c.acreage, c.living_area_sqft,
                          c.sale1_date, c.sale_prc1, c.sale2_date, c.sale_prc2, c.sale3_date, c.sale_prc3,
                          ST_Distance(c.geom::geography, subj.pt::geography) AS dist
                     FROM parcels_current c, subj
                    WHERE c.county = $2 AND c.geom && ST_Expand(subj.geom, $3::float8)
                      AND c.gid <> $1 AND c.use_code IS NOT DISTINCT FROM $4::text
                      AND ST_DWithin(c.geom::geography, subj.pt::geography, $5::float8))
     SELECT cand.parcel_key, cand.parcel_id, cand.phy_addr1, cand.phy_city, cand.acreage, cand.living_area_sqft, cand.dist,
            sv.sale_date, sv.sale_price
       FROM cand CROSS JOIN LATERAL (VALUES (cand.sale1_date, cand.sale_prc1), (cand.sale2_date, cand.sale_prc2), (cand.sale3_date, cand.sale_prc3)) AS sv(sale_date, sale_price)
      WHERE sv.sale_price >= 10000
        AND sv.sale_date >= date_trunc('month', current_date - ($6::int * interval '1 month'))
      ORDER BY cand.dist ASC, sv.sale_date DESC LIMIT 30`,
    [s.gid, s.county, deg, s.use_code, meters, o.months],
  );
  const comps: CompRow[] = rows.map((r) => {
    const ac = num(r.acreage), sq = num(r.living_area_sqft), pr = Number(r.sale_price);
    return {
      parcel_key: r.parcel_key, parcel_id: r.parcel_id, situs_address: join(r.phy_addr1, r.phy_city) || null,
      distance_miles: Math.round((Number(r.dist) / 1609.344) * 100) / 100, sale_date: dateStr(r.sale_date), sale_price: pr,
      acreage: ac === null ? null : Math.round(ac * 100) / 100, living_area_sqft: sq || null,
      price_per_acre: ac && ac > 0 ? Math.round(pr / ac) : null, price_per_sqft: sq && sq > 0 ? Math.round(pr / sq) : null,
    };
  });
  const notes = [SALES_COVERAGE_NOTE, 'Comps are same county and same land-use code as the subject, qualified sales of $10,000+, nearest first.'];
  if (comps.length === 0) notes.push('No qualifying comps found; try a larger radius or longer window.');
  return {
    subject: { parcel_key: s.parcel_key, use_code: s.use_code || null, acreage: num(s.acreage), living_area_sqft: num(s.living_area_sqft) || null, jv: num(s.jv) },
    radius_miles: o.radiusMiles, months: o.months, count: comps.length, returned: Math.min(comps.length, 20),
    median_price: median(comps.map((c) => c.sale_price)),
    median_price_per_acre: median(comps.map((c) => c.price_per_acre).filter((x): x is number => x !== null)),
    median_price_per_sqft: median(comps.map((c) => c.price_per_sqft).filter((x): x is number => x !== null)),
    comps: comps.slice(0, 20), notes,
  };
}

// ---------- parcelContext ----------
export interface ParcelContext {
  parcel_key: string; county: string; lat: number | null; lon: number | null;
  flood: { zone_at_point: string | null; sfha_at_point: boolean | null; zones_intersecting: { zone: string; subtype: string | null; sfha: boolean }[] };
  highways: { name: string | null; type: string | null; distance_miles: number }[];
  notes: string[];
}
export async function parcelContext(userId: string, parcelKey: string): Promise<ParcelContext> {
  const a = await resolveAccess(userId);
  const s = await loadSubject(a, parcelKey);
  needGeometry(s);
  const [fl, hw] = await Promise.all([
    run(
      `WITH g AS (SELECT geom, ST_PointOnSurface(geom) AS pt FROM parcels_current WHERE gid = $1)
       SELECT fh.fld_zone, fh.zone_subty, fh.sfha_tf, bool_or(ST_Intersects(fh.geom_safe, g.pt)) AS at_point
         FROM flood_hazard fh, g WHERE fh.geom_safe && g.geom AND ST_Intersects(fh.geom_safe, g.geom)
        GROUP BY 1,2,3 ORDER BY at_point DESC, 1`, [s.gid], 20_000),
    run(
      `WITH g AS (SELECT ST_PointOnSurface(geom) AS pt FROM parcels_current WHERE gid = $1)
       SELECT h.name, h.type, ST_Distance(h.geom::geography, g.pt::geography) AS d FROM highways h, g ORDER BY h.geom <-> g.pt LIMIT 3`, [s.gid], 20_000),
  ]);
  const atPoint = fl.find((r) => r.at_point);
  return {
    parcel_key: s.parcel_key, county: s.county, lat: num(s.latitude), lon: num(s.longitude),
    flood: {
      zone_at_point: atPoint ? atPoint.fld_zone : null,
      sfha_at_point: atPoint ? atPoint.sfha_tf === 'T' : null,
      zones_intersecting: fl.map((r) => ({ zone: r.fld_zone, subtype: r.zone_subty || null, sfha: r.sfha_tf === 'T' })),
    },
    highways: hw.map((r) => ({ name: r.name, type: r.type, distance_miles: Math.round((Number(r.d) / 1609.344) * 100) / 100 })),
    notes: ['Flood zones are FEMA NFHL polygons stored in flood_hazard (zone_at_point uses a point inside the parcel). Highways are FDOT interstates and US highways only. Not a flood determination.'],
  };
}
