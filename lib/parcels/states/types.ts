// State mapping layer. Everything state-specific (county numbering, land-use code tables, exemption fields,
// disclaimers) lives in a StateProfile. Query/tool logic only speaks the neutral vocabulary below.

/** Neutral property categories used by tools and prompts across all states. */
export const PROPERTY_TYPES = [
  'single_family', 'mobile_home', 'condo', 'multifamily', 'vacant_residential', 'other_residential',
  'vacant_commercial', 'commercial', 'industrial', 'agricultural', 'institutional', 'government', 'other',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface StateProfile {
  /** USPS code, e.g. 'FL'. Matches parcels_current.state and the parcel_key prefix. */
  state: string;
  name: string;
  /** Counties in numbering order; county number = coNoBase + index. Names match parcels_current.county. */
  counties: string[];
  coNoBase: number;
  /** Maps a raw state land-use code to a neutral property type (null if unknown). */
  propertyTypeOf(useCode: string | null | undefined): PropertyType | null;
  /** Raw state land-use codes belonging to the given neutral types. */
  useCodesFor(types: PropertyType[]): string[];
  /** Human label for a raw land-use code. */
  describeUseCode(useCode: string | null | undefined): string | null;
  /** Exemption columns (when the data source carries them) and what they mean. */
  exemptionFields: { field: string; label: string; statute: string | null }[];
  /** Plain-language limits of the underlying data, appended to tool notes. */
  dataNotes: string[];
  /** Where a user can verify facts (county property appraiser, etc.). */
  verifyHint: string;
}
