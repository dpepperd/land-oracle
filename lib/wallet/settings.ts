// Admin-editable settings (db table app_settings). Prices live in the database, never in code: if the row is missing or damaged, nothing is charged.
// Every priced item is { cents, enabled }. An item that is switched off cannot be charged, whatever its price.
import type { Pool, PoolClient } from 'pg';

export const POSTCARD_SIZES = ['4x6', '6x9', '6x11'] as const;
export type PostcardSize = (typeof POSTCARD_SIZES)[number];
export const postcardItem = (size: PostcardSize) => `postcard_${size}` as const;

/** Every item that can be priced. Postcards are live; the rest are placeholders switched off until a feature uses them. */
export const PRICE_ITEMS = ['postcard_4x6', 'postcard_6x9', 'postcard_6x11', 'skip_trace', 'property_data', 'permit', 'monitor_alert'] as const;
export type PriceItem = (typeof PRICE_ITEMS)[number];
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
