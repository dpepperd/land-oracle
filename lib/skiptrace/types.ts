// Skip tracing: the vendor-neutral shapes. A vendor is plugged in by implementing SkipTraceProvider (see providers.ts); nothing else changes.

/** What we know about an owner from the county roll. Name and mailing address are what vendors match on. */
export interface OwnerQuery {
  name: string;
  mailingAddress: string;
  propertyAddress?: string | null;
}

export interface ContactPhone {
  number: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
  /** True when the vendor says the number is on a do-not-call list. Unknown (undefined) is NOT the same as safe. */
  doNotCall?: boolean;
}

export interface ContactResult {
  matched: boolean;
  phones: ContactPhone[];
  emails: string[];
  /** Vendor id, e.g. "mock". */
  provider: string;
}

export interface SkipTraceProvider {
  id: string;
  /** Look up one owner. Throw ProviderError for any vendor / network failure (the account is then not charged and nothing is cached). */
  lookup(q: OwnerQuery): Promise<ContactResult>;
}

export class ProviderError extends Error {
  constructor(message: string) { super(message); this.name = 'ProviderError'; }
}

/** Errors the route turns into a plain JSON answer. `status` is the HTTP status. */
export class SkipTraceError extends Error {
  constructor(public code: 'not_available' | 'no_credits' | 'provider_failed' | 'no_owner' | 'forbidden' | 'not_found' | 'bad_request', message: string, public status: number) {
    super(message);
    this.name = 'SkipTraceError';
  }
}

/** What the caller gets back. */
export interface LookupOutcome extends ContactResult {
  /** True when the vendor was not called for this request (saved result). */
  cached: boolean;
  /** Credits taken for this request: 0 (saved result, miss, or already paid for by this account) or 1. */
  charged: number;
  creditsLeft: number;
}
