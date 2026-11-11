// Plain-language flood label for a parcel tile. Source: FEMA NFHL (live service, our own table as backup).
// Research aid only, not a flood determination.
export interface FloodLabel { text: string; tone: 'high' | 'low' | 'none' }

export interface FloodInfo { zone: string | null; sfha: boolean; source: 'fema' | 'db' | 'none' }

export function floodLabel(f: FloodInfo | undefined | null): FloodLabel | null {
  if (!f) return null; // not looked up yet
  if (f.source === 'none') return { text: 'Flood zone unknown - check FEMA map', tone: 'none' };
  if (!f.zone) return { text: 'No FEMA flood zone mapped here', tone: 'none' };
  if (f.zone === 'OPEN WATER') return { text: 'Open water', tone: 'none' };
  if (f.sfha) return { text: `Flood zone ${f.zone} (high risk)`, tone: 'high' };
  return { text: `Flood zone ${f.zone} (lower risk)`, tone: 'low' };
}

export const FLOOD_TONE_CLASS: Record<FloodLabel['tone'], string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  none: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300',
};
