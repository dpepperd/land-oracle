// Admin-editable settings (db table app_settings). Prices live in the database, never in code: if the row is missing or damaged, nothing is charged.
// Every priced item is { cents, enabled }. An item that is switched off cannot be charged, whatever its price.
import type { Pool, PoolClient } from 'pg';

export const POSTCARD_SIZES = ['4x6', '6x9', '6x11'] as const;
export type PostcardSize = (typeof POSTCARD_SIZES)[number];
export const postcardItem = (size: PostcardSize) => `postcard_${size}` as const;

/** Every item that can be priced. Postcards are live; the rest are placeholders switched off until a feature uses them. */
export const PRICE_ITEMS = ['postcard_4x6', 'postcard_6x9', 'postcard_6x11', 'skip_trace', 'skip_trace_dnc', 'property_data', 'permit', 'monitor_alert'] as const;
export type PriceItem = (typeof PRICE_ITEMS)[number];
/** Items added after the first release. A saved prices row without them still works: they count as switched off (cannot be charged) until an admin sets them. */
const NEWER_ITEMS: readonly PriceItem[] = ['skip_trace_dnc'];
export interface PriceEntry { cents: number; enabled: boolean }
export type Prices = Record<PriceItem, PriceEntry>;
type Db = Pool | PoolClient;

export class SettingsError extends Error {
  constructor(message: string) { super(message); this.name = 'SettingsError'; }
}

export function validatePrices(v: unknown): Prices {
  if (!v || typeof v !== 'object') throw new SettingsError('Prices are not set up.');
  const out: any = {};
  for (const k of PRICE_ITEMS) {
    const e = (v as any)[k];
    if (e === undefined && NEWER_ITEMS.includes(k)) { out[k] = { cents: 0, enabled: false }; continue; }
    if (!e || typeof e !== 'object' || !Number.isInteger(e.cents) || e.cents < 0 || e.cents > 100_000 || typeof e.enabled !== 'boolean') {
      throw new SettingsError(`The price for ${k} is missing or invalid.`);
    }
    out[k] = { cents: e.cents, enabled: e.enabled };
  }
  return out as Prices;
}

export async function getPrices(db: Db): Promise<Prices> {
  const r = await db.query("SELECT value FROM app_settings WHERE key = 'wallet_prices'");
  return validatePrices(r.rows[0]?.value);
}

export async function setPrices(db: Db, prices: unknown, adminUserId: number | null): Promise<Prices> {
  const p = validatePrices(prices);
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ('wallet_prices', $1::jsonb, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(p), adminUserId]);
  return p;
}

export interface ReturnAddress { name: string; address_line1: string; address_line2: string; city: string; state: string; zip: string }

/** The sender address printed on postcards. Null until an admin fills it in, which keeps postcards blocked. */
export async function getReturnAddress(db: Db): Promise<ReturnAddress | null> {
  const r = (await db.query("SELECT value FROM app_settings WHERE key = 'postcard_return_address'")).rows[0]?.value;
  if (!r || !r.name || !r.address_line1 || !r.city || !r.state || !r.zip) return null;
  return { name: r.name, address_line1: r.address_line1, address_line2: r.address_line2 || '', city: r.city, state: r.state, zip: r.zip };
}

export async function setReturnAddress(db: Db, a: ReturnAddress, adminUserId: number | null) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ('postcard_return_address', $1::jsonb, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(a), adminUserId]);
}

// ---- Skip trace options (admin-editable). The Do Not Call (DNC) check is an add-on item (skip_trace_dnc). Its mode says how it is sold:
//   off       not sold (the default: nothing is offered until an admin chooses)
//   optional  the buyer ticks "include Do Not Call check" and pays the extra price
//   required  every lookup includes it and costs contact + DNC together (contact data is never sold without the check)
export const DNC_MODES = ['off', 'optional', 'required'] as const;
export type DncMode = (typeof DNC_MODES)[number];
export interface SkipTraceOptions { dnc: DncMode }

export function validateSkipTraceOptions(v: unknown): SkipTraceOptions {
  const mode = (v as any)?.dnc;
  if (!DNC_MODES.includes(mode)) throw new SettingsError('Skip trace options are invalid.');
  return { dnc: mode };
}

/** Missing row = DNC off. A damaged row throws SettingsError, and the skip trace service then refuses lookups (fails closed, so it can never sell contact data without the check by accident). */
export async function getSkipTraceOptions(db: Db): Promise<SkipTraceOptions> {
  const r = await db.query("SELECT value FROM app_settings WHERE key = 'skiptrace_options'");
  if (!r.rows[0]) return { dnc: 'off' };
  return validateSkipTraceOptions(r.rows[0].value);
}

export async function setSkipTraceOptions(db: Db, o: unknown, adminUserId: number | null): Promise<SkipTraceOptions> {
  const v = validateSkipTraceOptions(o);
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ('skiptrace_options', $1::jsonb, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(v), adminUserId]);
  return v;
}
