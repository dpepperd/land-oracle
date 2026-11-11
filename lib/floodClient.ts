'use client';
// Client-side flood zone store: batches requests to /api/parcels/flood and lets components subscribe.
import { useSyncExternalStore } from 'react';
import type { FloodInfo } from '@/lib/floodLabel';

const store = new Map<string, FloodInfo>();
const pending = new Map<string, { key: string; lat: number; lon: number }>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const emit = () => { version++; listeners.forEach((l) => l()); };

async function flush() {
  timer = null;
  const batch = Array.from(pending.values()).slice(0, 60);
  batch.forEach((p) => { pending.delete(p.key); inflight.add(p.key); });
  if (batch.length === 0) return;
  try {
    const res = await fetch('/api/parcels/flood', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: batch }),
    });
    if (res.ok) {
      const { results } = await res.json();
      for (const [k, v] of Object.entries<FloodInfo>(results || {})) store.set(k, v);
    } else {
      batch.forEach((p) => store.set(p.key, { zone: null, sfha: false, source: 'none' }));
    }
  } catch {
    batch.forEach((p) => store.set(p.key, { zone: null, sfha: false, source: 'none' }));
  } finally {
    batch.forEach((p) => inflight.delete(p.key));
    emit();
    if (pending.size > 0) timer = setTimeout(flush, 50);
  }
}

export function requestFlood(key: string, lat: unknown, lon: unknown) {
  const la = Number(lat), lo = Number(lon);
  if (!key || !Number.isFinite(la) || !Number.isFinite(lo)) return;
  if (store.has(key) || inflight.has(key) || pending.has(key)) return;
  pending.set(key, { key, lat: la, lon: lo });
  if (!timer) timer = setTimeout(flush, 150);
}

export function useFlood(key: string | undefined): FloodInfo | undefined {
  useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => version,
    () => 0,
  );
  return key ? store.get(key) : undefined;
}
