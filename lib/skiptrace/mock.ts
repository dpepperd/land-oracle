// A fake vendor for tests and local development. It invents obviously fictional contacts (555-01xx numbers, example.com emails).
// getProvider() refuses to hand this out in production, so real customers can never be shown fake numbers.
import { ProviderError, type ContactResult, type LookupRequest, type OwnerQuery, type SkipTraceProvider } from './types';

/** Counts vendor calls so tests can prove the cache works. Reset with resetMockCalls(). */
let calls = 0;
let dncCalls = 0;
export const mockCalls = () => calls;
/** How many vendor calls asked for the Do Not Call check. */
export const mockDncCalls = () => dncCalls;
export const resetMockCalls = () => { calls = 0; dncCalls = 0; };

function hash(s: string): number { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export const mockProvider: SkipTraceProvider = {
  id: 'mock',
  capabilities: { dnc: true },
  async lookup(q: OwnerQuery, req: LookupRequest = {}): Promise<ContactResult> {
    calls += 1;
    if (req.dnc) dncCalls += 1;
    const name = q.name.toUpperCase();
    if (name.includes('BOOM')) throw new ProviderError('mock vendor failure');            // simulate an outage
    if (name.includes('NOMATCH')) return { matched: false, phones: [], emails: [], provider: 'mock' }; // simulate a miss
    const h = hash(name + '|' + q.mailingAddress.toUpperCase());
    const n = (k: number) => String((h >>> k) % 100).padStart(2, '0');
    // doNotCall is only filled in when the Do Not Call check was asked for, like a real vendor that charges for it.
    return {
      matched: true,
      provider: 'mock',
      phones: [
        { number: `(305) 555-01${n(0)}`, type: 'mobile', ...(req.dnc ? { doNotCall: h % 5 === 0 } : {}) },
        { number: `(305) 555-01${n(8)}`, type: 'landline', ...(req.dnc ? { doNotCall: false } : {}) },
      ],
      emails: [`owner${h % 1000}@example.com`],
    };
  },
};
