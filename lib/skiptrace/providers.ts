// Which vendor to use. SKIPTRACE_PROVIDER names one; to add a real vendor, implement SkipTraceProvider (types.ts) in its own file
// and add one line to REGISTRY. No vendor is implemented yet: see docs/skip-trace-vendors.md for the options.
import { mockProvider } from './mock';
import type { SkipTraceProvider } from './types';

const REGISTRY: Record<string, () => SkipTraceProvider> = {
  mock: () => {
    // Fake contacts must never reach real customers.
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error('The mock skip trace provider cannot be used in production.');
    return mockProvider;
  },
};

export function getProvider(id: string | undefined = process.env.SKIPTRACE_PROVIDER): SkipTraceProvider {
  const make = id ? REGISTRY[id] : undefined;
  if (!make) throw new Error(`No skip trace provider is configured (SKIPTRACE_PROVIDER=${id ?? 'unset'}).`);
  return make();
}
