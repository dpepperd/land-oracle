// Registry of state profiles. Adding a state = add a profile file + register it here; no query/tool code changes.
import { FL } from './fl';
import type { StateProfile } from './types';
export * from './types';

const REGISTRY: Record<string, StateProfile> = { FL };
export const DEFAULT_STATE = 'FL';
export const SUPPORTED_STATES = Object.keys(REGISTRY);

export function getState(state: string | null | undefined): StateProfile {
  const p = REGISTRY[String(state ?? DEFAULT_STATE).toUpperCase()];
  if (!p) throw new Error(`Unsupported state: ${state}`);
  return p;
}
export function isSupportedState(state: string): boolean { return !!REGISTRY[state.toUpperCase()]; }
