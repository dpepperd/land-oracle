// The drawn search area ("Draw search area" on the map) is kept separate from the sidebar filters, so changing or applying filters
// can never drop it. Only the map's Clear Shape button and the sidebar's Clear All / Reset remove it.

export interface SearchArea {
  /** GeoJSON Feature or Geometry (Polygon, or Circle with properties.radius) as sent to /api/parcels/search */
  shape: any;
  /** [minLat, maxLat, minLon, maxLon] */
  bounds: [number, number, number, number];
}

const AREA_KEYS = ['spatialShape', 'minLat', 'maxLat', 'minLon', 'maxLon'] as const;

/** Filters as the search API expects them: the sidebar filters plus the current area (or no area at all). */
export function withArea<T extends Record<string, any>>(filters: T, area: SearchArea | null): T {
  const base: Record<string, any> = { ...filters };
  if (!area) {
    base.spatialShape = null;
    base.minLat = undefined; base.maxLat = undefined; base.minLon = undefined; base.maxLon = undefined;
    return base as T;
  }
  base.spatialShape = area.shape;
  base.minLat = area.bounds[0]; base.maxLat = area.bounds[1]; base.minLon = area.bounds[2]; base.maxLon = area.bounds[3];
  return base as T;
}

/** Sidebar filters without any area fields (the area lives in its own state). */
export function stripArea<T extends Record<string, any>>(filters: T): T {
  const base: Record<string, any> = { ...filters };
  for (const k of AREA_KEYS) delete base[k];
  return base as T;
}
