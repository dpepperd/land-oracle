
export type RegionKey = 'panhandle' | 'north' | 'central' | 'south';

export const REGION_COLORS: Record<RegionKey, string> = {
  panhandle: '#558B6E', // Green (Matches Map)
  north: '#A66C6C',     // Red/Brown
  central: '#D4D758',   // Yellow
  south: '#9B7EBD'      // Purple
};

export const REGION_LABELS: Record<RegionKey, string> = {
  panhandle: 'Panhandle',
  north: 'North Florida',
  central: 'Central Florida',
  south: 'South Florida'
};

export const COUNTY_REGIONS: Record<string, RegionKey> = {
  // PANHANDLE (Green)
  'Escambia': 'panhandle',
  'Santa Rosa': 'panhandle',
  'Okaloosa': 'panhandle',
  'Walton': 'panhandle',
  'Holmes': 'panhandle',
  'Washington': 'panhandle',
  'Bay': 'panhandle',
  'Jackson': 'panhandle',
  'Calhoun': 'panhandle',
  'Gulf': 'panhandle',
  'Gadsden': 'panhandle',
  'Liberty': 'panhandle',
  'Franklin': 'panhandle',
  'Leon': 'panhandle',
  'Wakulla': 'panhandle',
  'Jefferson': 'panhandle',
  'Madison': 'panhandle',
  'Taylor': 'panhandle',

  // NORTH (Red/Brown)
  'Hamilton': 'north',
  'Suwannee': 'north',
  'Lafayette': 'north',
  'Dixie': 'north',
  'Columbia': 'north',
  'Gilchrist': 'north',
  'Levy': 'north',
  'Baker': 'north',
  'Union': 'north',
  'Bradford': 'north',
  'Alachua': 'north',
  'Nassau': 'north',
  'Duval': 'north',
  'Clay': 'north',
  'Saint Johns': 'north',
  'St. Johns': 'north', // Alias
  'Putnam': 'north',
  'Flagler': 'north',
  'Marion': 'north',

  // CENTRAL (Yellow)
  'Citrus': 'central',
  'Sumter': 'central',
  'Lake': 'central',
  'Volusia': 'central',
  'Seminole': 'central',
  'Orange': 'central',
  'Hernando': 'central',
  'Pasco': 'central',
  'Pinellas': 'central',
  'Hillsborough': 'central',
  'Polk': 'central',
  'Osceola': 'central',
  'Brevard': 'central',
  'Indian River': 'central',
  'Manatee': 'central',
  'Hardee': 'central',
  'Highlands': 'central',
  'Okeechobee': 'central',
  'Saint Lucie': 'central',
  'St. Lucie': 'central', // Alias

  // SOUTH (Purple)
  'Sarasota': 'south',
  'DeSoto': 'south',
  'Glades': 'south',
  'Martin': 'south',
  'Charlotte': 'south',
  'Lee': 'south',
  'Hendry': 'south',
  'Palm Beach': 'south',
  'Collier': 'south',
  'Broward': 'south',
  'Miami-Dade': 'south',
  'Monroe': 'south'
};
