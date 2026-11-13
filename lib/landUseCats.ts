// Plain land-use categories for the pilot states (NC, TX). Florida keeps its DOR codes.
// Texas: derived from the statewide property class letter (A, B, C ...). North Carolina: from each county's own wording.
export const LAND_USE_CATS = [
  { key: 'residential', label: 'Residential' },
  { key: 'multifamily', label: 'Multifamily' },
  { key: 'vacant', label: 'Vacant land' },
  { key: 'agricultural', label: 'Agricultural / rural' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'industrial', label: 'Industrial' },
  { key: 'exempt', label: 'Exempt / government' },
  { key: 'other', label: 'Other' },
] as const;
export type LandUseCat = (typeof LAND_USE_CATS)[number]['key'];
export const LAND_USE_CAT_KEYS = LAND_USE_CATS.map((c) => c.key) as [LandUseCat, ...LandUseCat[]];
