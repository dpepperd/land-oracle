// Client-safe helpers for parcel_key = "<STATE>-<co_no>-<separator-preserving normalised id>", e.g. "FL-20-41-04-26-019193-000-00".
// Mirrors SQL normalize_parcel_id_sep() (db/migrations/002). County numbering comes from the state profile (lib/parcels/states).
import { canonCounty } from '@/lib/counties';
import { DEFAULT_STATE, getState, isSupportedState } from './states';

export function countyCode(county: string, state: string = DEFAULT_STATE): number | null {
  const p = getState(state);
  const c = canonCounty(county).replace(/\s+county$/, '').replace(/^miami dade$/, 'miami-dade');
  const i = p.counties.findIndex((n) => canonCounty(n) === c);
  return i < 0 ? null : p.coNoBase + i;
}
export function countyName(coNo: number, state: string = DEFAULT_STATE): string | null {
  const p = getState(state);
  return p.counties[coNo - p.coNoBase] ?? null;
}

export function normalizeParcelIdSep(raw: string | null | undefined, county: string): string | null {
  if (raw == null) return null;
  const prefix = county.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[ ]*');
  const s = raw.trim().replace(new RegExp(`^\\s*${prefix}\\s*-+\\s*`, 'i'), '').toUpperCase().replace(/[\s.\-]+/g, '-');
  const out = s.replace(/^-+|-+$/g, '');
  return out || null;
}

export function parcelKeyFor(county: string, parcelId: string | null | undefined, state: string = DEFAULT_STATE): string | null {
  const co = countyCode(county, state);
  const sep = normalizeParcelIdSep(parcelId, county);
  return co && sep ? `${state.toUpperCase()}-${co}-${sep}` : null;
}

export function parseParcelKey(key: string): { state: string; coNo: number; county: string; id: string } | null {
  const m = /^([A-Za-z]{2})-(\d{2,3})-(.+)$/.exec(key.trim());
  if (!m) return null;
  const state = m[1].toUpperCase();
  if (!isSupportedState(state)) return null;
  const county = countyName(Number(m[2]), state);
  return county ? { state, coNo: Number(m[2]), county, id: m[3] } : null;
}
