export const FLORIDA_COUNTIES = [
  "Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte", "Citrus", 
  "Clay", "Collier", "Columbia", "DeSoto", "Dixie", "Duval", "Escambia", "Flagler", "Franklin", 
  "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee", "Hendry", "Hernando", "Highlands", 
  "Hillsborough", "Holmes", "Indian River", "Jackson", "Jefferson", "Lafayette", "Lake", "Lee", 
  "Leon", "Levy", "Liberty", "Madison", "Manatee", "Marion", "Martin", "Miami-Dade", "Monroe", 
  "Nassau", "Okaloosa", "Okeechobee", "Orange", "Osceola", "Palm Beach", "Pasco", "Pinellas", 
  "Polk", "Putnam", "Saint Johns", "St. Lucie", "Santa Rosa", "Sarasota", "Seminole", "Sumter", 
  "Suwannee", "Taylor", "Union", "Volusia", "Wakulla", "Walton", "Washington"
];

// parcels_v2 + DOR 2026 roll cover all 67 counties.
export const LIVE_COUNTIES = FLORIDA_COUNTIES;



/**
 * Canonical county key for comparisons: lowercase, trimmed, whitespace collapsed,
 * and "St." normalised to "Saint" (the DB stores "Saint Lucie"/"Saint Johns").
 * Use for EXACT matching of county names (entitlements, SQL filters).
 */
export function canonCounty(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^st\.?\s+/, 'saint ');
}

/** Requested counties the user is entitled to, by exact (canonical) match. */
export function filterAllowedCounties(requested: string[], allowed: string[]): string[] {
  const allow = new Set(allowed.map(canonCounty));
  return requested.filter((c) => allow.has(canonCounty(c)));
}

export const FLORIDA_REGIONS = {
  "Panhandle": [
    "Escambia", "Santa Rosa", "Okaloosa", "Walton", "Holmes", "Washington", "Bay", 
    "Jackson", "Calhoun", "Gulf", "Gadsden", "Liberty", "Franklin", "Leon", 
    "Wakulla", "Jefferson", "Madison", "Taylor"
  ],
  "Northeast": [
    "Hamilton", "Suwannee", "Lafayette", "Dixie", "Columbia", "Gilchrist", "Baker", 
    "Union", "Bradford", "Alachua", "Marion", "Nassau", "Duval", "Clay", "Saint Johns", 
    "Putnam", "Flagler", "Levy"
  ],
  "Central Florida": [
    "Citrus", "Sumter", "Lake", "Volusia", "Seminole", "Hernando", "Pasco", 
    "Pinellas", "Hillsborough", "Manatee", "Orange", "Brevard", "Osceola", 
    "Polk", "Hardee", "Highlands", "Okeechobee", "St. Lucie", "Indian River"
  ],
  "South Florida": [
    "Sarasota", "DeSoto", "Charlotte", "Glades", "Martin", "Lee", "Hendry", 
    "Palm Beach", "Collier", "Broward", "Monroe", "Miami-Dade"
  ]
};

// Included counties per plan (add-ons raise a subscriber's allowance; see lib/plans.ts and users.county_allowance).
export const TIER_QUOTAS = {
  free: 1,
  scout: 1,
  pro: 3,
  statewide: 67,
  enterprise: 67
};
