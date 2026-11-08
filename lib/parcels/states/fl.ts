// Florida mapping: DOR county numbers (11..77), DOR land-use codes (000-099), NAL exemption fields.
// Tables are generated from the DOR Quick Reference (scripts/ai/gen-fl-codes.js -> fl-codes.json).
import codes from './fl-codes.json';
import type { PropertyType, StateProfile } from './types';

const COUNTIES = [
  'Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia',
  'Miami-Dade', 'Desoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 'Glades', 'Gulf', 'Hamilton',
  'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River', 'Jackson', 'Jefferson', 'Lafayette', 'Lake',
  'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee', 'Marion', 'Martin', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee', 'Orange',
  'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Saint Johns', 'Saint Lucie', 'Santa Rosa', 'Sarasota', 'Seminole',
  'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington',
];

// DOR land-use code -> neutral type. Codes in the DOR User Guide: 000-009 residential, 010-039 commercial (003 = 10+ unit
// multifamily), 040-049 industrial, 050-069 agricultural, 070-079 institutional, 080-089 governmental, 090-099 misc.
const EXPLICIT: Record<string, PropertyType> = {
  '000': 'vacant_residential', '001': 'single_family', '002': 'mobile_home', '003': 'multifamily', '004': 'condo', '005': 'condo',
  '006': 'other_residential', '007': 'other_residential', '008': 'multifamily', '009': 'other_residential', '010': 'vacant_commercial',
};
function typeOf(code: string | null | undefined): PropertyType | null {
  if (!code) return null;
  const c = String(code).trim().padStart(3, '0');
  if (EXPLICIT[c]) return EXPLICIT[c];
  const n = Number(c);
  if (!Number.isFinite(n)) return null;
  if (n >= 11 && n <= 39) return 'commercial';
  if (n >= 40 && n <= 49) return 'industrial';
  if (n >= 50 && n <= 69) return 'agricultural';
  if (n >= 70 && n <= 79) return 'institutional';
  if (n >= 80 && n <= 89) return 'government';
  return n <= 99 ? 'other' : null;
}
const ALL_CODES = Object.keys((codes as any).useCodes).sort();

export const FL: StateProfile = {
  state: 'FL',
  name: 'Florida',
  counties: COUNTIES,
  coNoBase: 11,
  propertyTypeOf: typeOf,
  useCodesFor: (types) => ALL_CODES.filter((c) => { const t = typeOf(c); return t !== null && types.includes(t); }),
  describeUseCode: (c) => (c ? (codes as any).useCodes[String(c).trim().padStart(3, '0')]?.label ?? null : null),
  exemptionFields: (codes as any).exemptions,
  dataNotes: [
    'Florida property data: DOR NAL/SDF rolls. Just value (JV) is the appraiser\'s market estimate, not an appraisal or sale price.',
  ],
  verifyHint: 'the county property appraiser, the county clerk\'s official records, and a title company',
};
