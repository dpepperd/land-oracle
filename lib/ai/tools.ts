// Tool definitions + executor for the in-portal assistant. The Clerk userId is ALWAYS supplied by the server, never by the model;
// every tool goes through lib/parcels, which enforces county entitlement itself.
import { z } from 'zod';
import {
  AccessError, InputError, NotFoundError, compsSchema, getComps, getParcel, parcelContext, searchFilters, searchParcels,
} from '@/lib/parcels';

const parcelKey = z.string().min(5).max(80).describe('parcel_key from a previous tool result, e.g. "FL-20-41-04-26-019193-000-00"');

const SCHEMAS = {
  search_parcels: searchFilters,
  get_parcel: z.object({ parcel_key: parcelKey }),
  get_comps: z.object({ parcel_key: parcelKey }).extend(compsSchema.shape),
  get_parcel_context: z.object({ parcel_key: parcelKey }),
} as const;
type ToolName = keyof typeof SCHEMAS;

const DESCRIPTIONS: Record<ToolName, string> = {
  search_parcels:
    'Search parcels in one or more entitled counties. Filters: county, propertyTypes (neutral categories, preferred) or raw useCodes, acreage range, just-value (jv) range, absenteeOwner (mailing address differs from situs), minYearsSinceLastSale / maxYearsSinceLastSale, floodZones (FEMA zone letters such as AE, X, VE, or "SFHA" for any special flood hazard area). Returns at most 50 rows plus the total match count. A county is required.',
  get_parcel: 'Get details for one parcel by parcel_key: use, acreage, just value, owner and mailing address, situs, last five recorded sales with qualification flags.',
  get_comps: 'Nearby qualified sales ("comps") for a subject parcel: same county and same land-use code, within radiusMiles (default 1, max 5) and the last N months (default 24). Returns up to 20 comps nearest first with price per acre / per sqft and medians.',
  get_parcel_context: 'Flood zone(s) at and intersecting the parcel, and the nearest highways with distance in miles.',
};

export function toolDefinitions() {
  return (Object.keys(SCHEMAS) as ToolName[]).map((name) => {
    const { $schema: _s, ...schema } = z.toJSONSchema(SCHEMAS[name], { io: 'input' }) as Record<string, unknown>;
    return { name, description: DESCRIPTIONS[name], input_schema: schema as { type: 'object'; [k: string]: unknown }, eager_input_streaming: true };
  });
}

export interface ToolOutcome { ok: boolean; content: string; keys: string[]; summary: string }
const MAX_CHARS = 24_000;

function collectKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { if (k === 'parcel_key' && typeof x === 'string') out.add(x); else collectKeys(x, out); }
  }
  return out;
}

export async function executeTool(name: string, rawInput: unknown, userId: string): Promise<ToolOutcome> {
  if (!(name in SCHEMAS)) return { ok: false, content: JSON.stringify({ error: `Unknown tool ${name}` }), keys: [], summary: 'unknown tool' };
  const tn = name as ToolName;
  const parsed = SCHEMAS[tn].safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, content: JSON.stringify({ error: 'INVALID_INPUT', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }), keys: [], summary: 'invalid input' };
  }
  try {
    const a: any = parsed.data;
    let result: any, summary: string;
    if (tn === 'search_parcels') { result = await searchParcels(userId, a); summary = `${result.returned} of ${result.total} parcels`; }
    else if (tn === 'get_parcel') { result = await getParcel(userId, a.parcel_key); summary = result.parcel_id; }
    else if (tn === 'get_comps') { const { parcel_key, ...o } = a; result = await getComps(userId, parcel_key, o); summary = `${result.count} comps, median $${result.median_price ?? 'n/a'}`; }
    else { result = await parcelContext(userId, a.parcel_key); summary = `flood ${result.flood.zone_at_point ?? 'none at point'}`; }
    let content = JSON.stringify(result);
    if (content.length > MAX_CHARS && Array.isArray(result.rows)) {
      while (content.length > MAX_CHARS && result.rows.length > 5) { result.rows = result.rows.slice(0, Math.ceil(result.rows.length / 2)); result.truncated = true; content = JSON.stringify(result); }
    }
    return { ok: true, content: content.slice(0, MAX_CHARS * 2), keys: [...collectKeys(result)], summary };
  } catch (e: any) {
    if (e instanceof AccessError || e instanceof InputError || e instanceof NotFoundError) {
      return { ok: false, content: JSON.stringify({ error: e.name, message: e.message }), keys: [], summary: e.message };
    }
    console.error('[ai-tool] failure', name, e?.message);
    return { ok: false, content: JSON.stringify({ error: 'TOOL_FAILED', message: 'The data lookup failed. Try again or narrow the request.' }), keys: [], summary: 'lookup failed' };
  }
}
