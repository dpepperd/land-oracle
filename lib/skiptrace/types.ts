// Skip tracing: the vendor-neutral shapes. A vendor is plugged in by implementing SkipTraceProvider (see providers.ts); nothing else changes.
// Paid from the wallet (lib/wallet): contact data is the item `skip_trace`, the Do Not Call check is the add-on item `skip_trace_dnc`.

/** What we know about an owner from the county roll. Name and mailing address are what vendors match on. */
export interface OwnerQuery {
  name: string;
  mailingAddress: string;
  propertyAddress?: string | null;
}

export interface ContactPhone {
  number: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
  /** True when the vendor says the number is on a do-not-call list. Only present when the Do Not Call check was bought. Unknown (undefined) is NOT the same as safe. */
  doNotCall?: boolean;
}

export interface ContactResult {
  matched: boolean;
  phones: ContactPhone[];
  emails: string[];
  /** Vendor id, e.g. "mock". */
  provider: string;
}

/** What a vendor can do beyond plain contact data. An add-on is only sold when the active vendor supports it. */
export interface ProviderCapabilities { dnc: boolean }

export interface LookupRequest {
  /** Also check the phones against the Do Not Call lists and set doNotCall on each. */
  dnc?: boolean;
}

export interface SkipTraceProvider {
  id: string;
  capabilities: ProviderCapabilities;
  /** Look up one owner. Throw ProviderError for any vendor / network failure (the account is then not charged and nothing is cached). */
  lookup(q: OwnerQuery, req?: LookupRequest): Promise<ContactResult>;
}

export class ProviderError extends Error {
  constructor(message: string) { super(message); this.name = 'ProviderError'; }
}

/** Errors the route turns into a plain JSON answer. `status` is the HTTP status. */
export class SkipTraceError extends Error {
  constructor(public code: 'not_available' | 'insufficient_funds' | 'provider_failed' | 'no_owner' | 'forbidden' | 'not_found' | 'bad_request', message: string, public status: number) {
    super(message);
    this.name = 'SkipTraceError';
  }
}

/** What the caller gets back. */
export interface LookupOutcome extends ContactResult {
  /** True when the vendor was not called for this request (saved result). */
  cached: boolean;
  /** Cents taken from the wallet for this request, in total and by item. All 0 for a saved result, a miss, or something this account already paid for. */
  chargedCents: number;
  chargedContactCents: number;
  chargedDncCents: number;
  /** Spendable wallet money after this request. */
  balanceCents: number;
  /** True when the Do Not Call status is included in this result (the flags on the phones are valid). */
  dncIncluded: boolean;
  /** When the Do Not Call status was checked (ISO), if included. It goes stale: re-check before calling. */
  dncCheckedAt: string | null;
}
