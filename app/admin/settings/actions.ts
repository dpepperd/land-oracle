'use server';

import { currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import pool from '@/lib/db';
import { getPrices, getReturnAddress, getSkipTraceOptions, PRICE_ITEMS, setPrices, setReturnAddress, setSkipTraceOptions, SettingsError, type DncMode, type Prices, type ReturnAddress } from '@/lib/wallet/settings';
import { parseUsdToCents } from '@/lib/wallet/money';

async function adminDbId(): Promise<number | null> {
  const u = await currentUser();
  if (!u) return null;
  const r = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [u.id]);
  return r.rows[0]?.id ?? null;
}

export async function loadSettings() {
  await requireAdmin();
  let prices: Prices | null = null;
  try { prices = await getPrices(pool); } catch { prices = null; }
  let dncMode: DncMode = 'off';
  try { dncMode = (await getSkipTraceOptions(pool)).dnc; } catch { dncMode = 'off'; }
  return { prices, returnAddress: await getReturnAddress(pool), dncMode };
}

/** How the Do Not Call check is sold with skip trace: off, optional (buyer ticks it) or required (every lookup includes it). */
export async function saveSkipTraceOptions(mode: string) {
  await requireAdmin();
  try {
    await setSkipTraceOptions(pool, { dnc: mode }, await adminDbId());
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof SettingsError ? 'Choose off, optional or required.' : 'Could not save.' };
  }
}

/** Each price item maps to { dollars: text like "1.15", enabled }. Anything that is not a valid dollar amount is refused and nothing is saved. */
export async function savePrices(entries: Record<string, { dollars: string; enabled: boolean }>) {
  await requireAdmin();
  const cents: Record<string, { cents: number; enabled: boolean }> = {};
  for (const k of PRICE_ITEMS) {
    const c = parseUsdToCents(entries[k]?.dollars ?? '');
    if (c === null) return { success: false, error: `Enter the price for ${k.replace('_', ' ')} like 1.15.` };
    cents[k] = { cents: c, enabled: !!entries[k]?.enabled };
  }
  try {
    await setPrices(pool, cents, await adminDbId());
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof SettingsError ? e.message : 'Could not save.' };
  }
}

export async function saveReturnAddress(a: ReturnAddress) {
  await requireAdmin();
  const clean = (s: string, n: number) => String(s ?? '').trim().slice(0, n);
  const v: ReturnAddress = { name: clean(a.name, 80), address_line1: clean(a.address_line1, 100), address_line2: clean(a.address_line2, 100), city: clean(a.city, 60), state: clean(a.state, 2).toUpperCase(), zip: clean(a.zip, 10) };
  if (!v.name || !v.address_line1 || !v.city || v.state.length !== 2 || !/^\d{5}(-\d{4})?$/.test(v.zip)) return { success: false, error: 'Fill in name, street, city, 2-letter state and a valid ZIP.' };
  await setReturnAddress(pool, v, await adminDbId());
  revalidatePath('/admin/settings');
  return { success: true };
}
