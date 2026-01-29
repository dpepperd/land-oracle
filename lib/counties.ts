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

// Counties with data currently loaded in the database
export const LIVE_COUNTIES = [
  "Alachua", "Baker", "Bradford", "Brevard", "Broward", "Charlotte", "Clay", "Collier", 
  "Duval", "Flagler", "Glades", "Hardee", "Hendry", "Highlands", "Indian River", "Lake", 
  "Lee", "Marion", "Martin", "Miami-Dade", "Monroe", "Nassau", "Okeechobee", "Orange", 
  "Osceola", "Palm Beach", "Polk", "Putnam", "Saint Johns", "St. Lucie", "Seminole", 
  "Union", "Volusia", "Sarasota"
];



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

export const TIER_QUOTAS = {
  demo: 0,
  scout: 1,
  local: 3,
  regional: 100, // All counties in a region?
  statewide: 67,
  enterprise: 67
};
