// FEMA flood zone lookup. Primary: FEMA's live NFHL service. Fallback: our own flood_hazard table (has gaps).
import pool from '@/lib/db';

const FEMA_URL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';

export interface FloodResult { zone: string | null; sfha: boolean; source: 'fema' | 'db' | 'none' }

const cache = new Map<string, { at: number; v: FloodResult }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 20000;

const keyFor = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

async function femaLookup(lat: number, lon: number): Promise<FloodResult | null> {
  const u = new URL(FEMA_URL);
  u.search = new URLSearchParams({
    geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE,SFHA_TF', returnGeometry: 'false', f: 'json',
  }).toString();
  const res = await fetch(u, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
  if (!res.ok) return null;
  const j: any = await res.json();
  if (j.error || !Array.isArray(j.features)) return null;
  if (j.features.length === 0) return { zone: null, sfha: false, source: 'fema' };
  // Prefer a special flood hazard area polygon if the point touches more than one
  const feats = j.features.map((f: any) => f.attributes || {});
  const best = feats.find((a: any) => a.SFHA_TF === 'T') || feats[0];
  const zone = best.FLD_ZONE ? String(best.FLD_ZONE) : null;
  if (zone && /open water/i.test(zone)) return { zone: 'OPEN WATER', sfha: false, source: 'fema' };
  return { zone, sfha: best.SFHA_TF === 'T', source: 'fema' };
}

async function dbLookup(lat: number, lon: number): Promise<FloodResult | null> {
  try {
    const r = await pool.query(
      `SELECT fld_zone, sfha_tf FROM flood_hazard
        WHERE geom_safe && ST_SetSRID(ST_MakePoint($1,$2),4326) AND ST_Intersects(geom_safe, ST_SetSRID(ST_MakePoint($1,$2),4326))
        ORDER BY (sfha_tf = 'T') DESC LIMIT 1`, [lon, lat]);
    if (r.rows.length === 0) return null; // our data has gaps: absence means unknown, not "no zone"
    return { zone: r.rows[0].fld_zone, sfha: r.rows[0].sfha_tf === 'T', source: 'db' };
  } catch { return null; }
}

export async function floodAt(lat: number, lon: number): Promise<FloodResult> {
  const k = keyFor(lat, lon);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let v: FloodResult | null = null;
  try { v = await femaLookup(lat, lon); } catch { v = null; }
  const fromFema = v !== null;
  if (!v) v = (await dbLookup(lat, lon)) ?? { zone: null, sfha: false, source: 'none' };
  // Only cache real answers (FEMA or DB hit), never a failure
  if (fromFema || v.source === 'db') {
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(k, { at: Date.now(), v });
  }
  return v;
}
