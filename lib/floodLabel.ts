// Plain-language flood label for a parcel tile. Source: FEMA NFHL polygon at a point inside the parcel. Not a flood determination.
export interface FloodLabel { text: string; tone: 'high' | 'low' | 'none' }

export function floodLabel(p: { flood_checked?: boolean; flood_zone?: string | null; flood_sfha?: boolean }): FloodLabel | null {
  if (!p.flood_checked) return null; // not looked up (large result sets)
  if (!p.flood_zone) return { text: 'Flood zone unknown - check FEMA map', tone: 'none' };
  if (p.flood_sfha) return { text: `Flood zone ${p.flood_zone} (high risk)`, tone: 'high' };
  return { text: `Flood zone ${p.flood_zone} (lower risk)`, tone: 'low' };
}

export const FLOOD_TONE_CLASS: Record<FloodLabel['tone'], string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  none: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300',
};
