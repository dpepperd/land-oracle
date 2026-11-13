// Maps a North Carolina county's own land-use wording to one of the shared categories (lib/landUseCats.ts).
// Returns null when the wording gives no clue. Order matters: the first matching rule wins.
const RULES = [
  ['exempt', /\b(EXEMPT|GOVERN|GOVT|MUNICIPAL|CHURCH|RELIGIOUS|SCHOOL|CEMETER|CHARIT|FEDERAL|STATE OWNED|COUNTY OWNED|CITY OWNED|PUBLIC|PUBLC|GOV|OTHER COUNTY PROP|HOSPITAL|FIRE DEPT|LIBRARY|INSTITUTION|HOUSING AUTH)/],
  ['other', /(HOMEOWNERS ASSOC|HOME OWNERS ASSOC|COMMON AREA|COMMON|HOA|RIGHT OF WAY|R\/W|EASEMENT|WASTE ?LAND)/],
  ['vacant', /(\bVAC\b|VACANT|UNIMPROVED|\bUNIMP\b|^V$|^V\d|\bVL\b|^VACANT)/],
  ['residential', /(MANUFACTURED(?! ?(BLDG|PLANT|FACILITY))|MULT[- ]?(I-)?SECT|SINGLE-SECT|SINGLE SECT|MANU)/],
  ['multifamily', /(MULTI|APARTMENT|\bAPTS?\b|DUPLEX|TRIPLEX|QUADPLEX|FOURPLEX|2-4 FAM|TWO FAMILY|TWO-FAMILY|3 OR MORE|MULTIPLE|APART)/],
  ['commercial', /(NON-?\s?RESIDENTIAL)/],
  ['residential', /(RESID|SINGLE[- ]?FAM|\bSFR\b|\bSFD\b|DWELLING|CONDO|TOWN ?(HOUSE|HOME)|MOBILE|MANUFACTURED HOME|\bMH\b|\bRES\b|^R$|^R\d|\bHOME\b|HOUSE|1[- ]?FAM|ONE FAMILY|ONE-FAMILY|LAKE ?(FRONT|HOME)|SEASONAL|\bDWELL)/],
  ['industrial', /(INDUSTR|MANUFACT|WAREHOUSE|MINING|QUARRY|UTILIT|\bPLANT\b|FACTORY)/],
  ['commercial', /(COMMERC|RETAIL|OFFICE|STORE|RESTAURANT|MOTEL|HOTEL|\bBANK\b|SERVICE STATION|GAS STATION|SHOPPING|BUSINESS|\bAUTO\b|CONVENIENCE|\bCOMM\b|^C$|^C\d|PARKING|GOLF|CAMP ?GROUND|CLUB|SERVICE|\bSHOP\b|MEDICAL|NURSING|DAYCARE|DAY CARE|FUNERAL|THEATER|BAR\b)/],
  ['agricultural', /(AGRI|\bAG\b|FARM|TIMBER|FOREST|WOOD ?LAND|CROP|PASTURE|HORTIC|PRESENT USE|\bPUV\b|ORCHARD|RANCH|\bRURAL\b|\bACREAGE\b|TREE|NURSERY|POULTRY|LIVESTOCK|^A$|^A\d)/],
];
function classify(desc) {
  if (desc == null) return null;
  const d = String(desc).toUpperCase().trim();
  if (!d) return null;
  for (const [cat, re] of RULES) if (re.test(d)) return cat;
  return null;
}
module.exports = { classify, RULES };
