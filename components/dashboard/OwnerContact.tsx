'use client';
// "Get owner contact" button for a parcel. Renders NOTHING unless the server says skip tracing is enabled (SKIPTRACE_ENABLED), so it is invisible while the flag is off.
import { useEffect, useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';

interface Status { enabled: boolean; credits?: number }
interface Outcome { matched: boolean; phones: { number: string; type?: string; doNotCall?: boolean }[]; emails: string[]; cached: boolean; charged: number; creditsLeft: number }

// One status request shared by every card on the screen (a results list can hold hundreds of cards).
let statusPromise: Promise<Status> | null = null;
const listeners = new Set<(s: Status) => void>();
function loadStatus(): Promise<Status> {
  statusPromise ??= fetch('/api/skiptrace').then((r) => (r.ok ? r.json() : { enabled: false })).catch(() => ({ enabled: false }));
  return statusPromise;
}
function publish(s: Status) { statusPromise = Promise.resolve(s); listeners.forEach((fn) => fn(s)); }

export default function OwnerContact({ parcelKey, state, variant = 'card' }: { parcelKey: string; state?: string; variant?: 'card' | 'popup' }) {
  const popup = variant === 'popup'; // the map popup has a white background; the results card follows the app theme
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state && state !== 'FL') return; // Florida parcels only
    let live = true;
    void loadStatus().then((s) => { if (live) setStatus(s); });
    const fn = (s: Status) => setStatus(s);
    listeners.add(fn);
    return () => { live = false; listeners.delete(fn); };
  }, [state]);

  if ((state && state !== 'FL') || !status?.enabled) return null;

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation(); // the card itself is clickable
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/skiptrace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parcel_key: parcelKey }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.message || 'The lookup failed. Please try again.'); return; }
      setOut(j as Outcome);
      publish({ enabled: true, credits: (j as Outcome).creditsLeft });
    } catch { setError('Connection problem. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`mt-2 pt-2 border-t ${popup ? 'border-gray-100' : 'border-theme'} text-xs`} onClick={(e) => e.stopPropagation()}>
      {!out ? (
        <button onClick={run} disabled={busy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-600/15 text-emerald-500 hover:bg-emerald-600/25 disabled:opacity-60 font-medium">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
          Get owner contact{typeof status.credits === 'number' ? ` (${status.credits} credit${status.credits === 1 ? '' : 's'} left)` : ''}
        </button>
      ) : out.matched ? (
        <div className={`space-y-1 ${popup ? 'text-gray-900' : 'text-theme-primary'}`}>
          {out.phones.map((p) => (
            <div key={p.number}>{p.number} <span className={popup ? 'text-gray-500' : 'text-theme-secondary'}>{p.type && p.type !== 'unknown' ? p.type : ''}</span>{p.doNotCall ? <span className="ml-1 text-amber-500 font-medium">Do Not Call</span> : null}</div>
          ))}
          {out.emails.map((m) => <div key={m}>{m}</div>)}
          <div className={`text-[10px] ${popup ? 'text-gray-500' : 'text-theme-secondary'}`}>
            Possible contacts, not verified. Check the Do Not Call list before calling or texting.
            {out.charged ? ' 1 credit used.' : ' No credit used.'} {out.creditsLeft} left.
          </div>
        </div>
      ) : (
        <div className={popup ? 'text-gray-500' : 'text-theme-secondary'}>No contact found for this owner. No credit used.</div>
      )}
      {error && <div className="mt-1 text-amber-500">{error}</div>}
    </div>
  );
}
