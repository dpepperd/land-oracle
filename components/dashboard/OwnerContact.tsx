'use client';
// "Get owner contact" button for a parcel, paid from the wallet. Renders NOTHING unless the server says skip tracing is enabled (SKIPTRACE_ENABLED)
// and a price is set, so it is invisible while the flag is off. The Do Not Call (DNC) check is an optional add-on or part of every lookup, as set by the admin.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Loader2 } from 'lucide-react';

interface Status { enabled: boolean; balanceCents?: number; contactCents?: number; dnc?: { mode: 'optional' | 'required'; cents: number } | null; totalCents?: number }
interface Outcome {
  matched: boolean; phones: { number: string; type?: string; doNotCall?: boolean }[]; emails: string[]; cached: boolean;
  chargedCents: number; balanceCents: number; dncIncluded: boolean; dncCheckedAt: string | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

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
  const [error, setError] = useState<{ text: string; funds: boolean } | null>(null);
  const [withDnc, setWithDnc] = useState(false);

  useEffect(() => {
    if (state && state !== 'FL') return; // Florida parcels only
    let live = true;
    void loadStatus().then((s) => { if (live) setStatus(s); });
    const fn = (s: Status) => setStatus(s);
    listeners.add(fn);
    return () => { live = false; listeners.delete(fn); };
  }, [state]);

  if ((state && state !== 'FL') || !status?.enabled) return null;

  const dnc = status.dnc ?? null;
  const dncOn = dnc?.mode === 'required' || (dnc?.mode === 'optional' && withDnc);
  const price = (status.contactCents ?? 0) + (dncOn && dnc ? dnc.cents : 0);
  const muted = popup ? 'text-gray-500' : 'text-theme-secondary';

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation(); // the card itself is clickable
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/skiptrace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parcel_key: parcelKey, dnc: dnc?.mode === 'optional' ? withDnc : undefined }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ text: j.message || 'The lookup failed. Please try again.', funds: j.error === 'insufficient_funds' }); return; }
      setOut(j as Outcome);
      publish({ ...status, balanceCents: (j as Outcome).balanceCents });
    } catch { setError({ text: 'Connection problem. Please try again.', funds: false }); }
    finally { setBusy(false); }
  };

  return (
    <div className={`mt-2 pt-2 border-t ${popup ? 'border-gray-100' : 'border-theme'} text-xs`} onClick={(e) => e.stopPropagation()}>
      {!out ? (
        <div className="space-y-1.5">
          {dnc?.mode === 'optional' && (
            <label className={`flex items-center gap-1.5 ${muted}`}>
              <input type="checkbox" checked={withDnc} onChange={(e) => setWithDnc(e.target.checked)} />
              Include Do Not Call check (+{usd(dnc.cents)})
            </label>
          )}
          <button onClick={run} disabled={busy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-600/15 text-emerald-500 hover:bg-emerald-600/25 disabled:opacity-60 font-medium">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
            Get owner contact ({usd(price)}{dnc?.mode === 'required' ? ', includes Do Not Call check' : ''})
          </button>
          {typeof status.balanceCents === 'number' && <div className={muted}>Wallet balance {usd(status.balanceCents)}. Charged only if a contact is found.</div>}
        </div>
      ) : out.matched ? (
        <div className={`space-y-1 ${popup ? 'text-gray-900' : 'text-theme-primary'}`}>
          {out.phones.map((p) => (
            <div key={p.number}>
              {p.number} <span className={muted}>{p.type && p.type !== 'unknown' ? p.type : ''}</span>
              {out.dncIncluded && (p.doNotCall ? <span className="ml-1 text-amber-500 font-semibold">Do Not Call</span> : <span className={`ml-1 ${muted}`}>not on Do Not Call list</span>)}
            </div>
          ))}
          {out.emails.map((m) => <div key={m}>{m}</div>)}
          <div className={`text-[10px] ${muted}`}>
            Possible contacts, not verified.{' '}
            {out.dncIncluded
              ? `Do Not Call status checked ${out.dncCheckedAt ? new Date(out.dncCheckedAt).toLocaleDateString() : 'recently'}; check again before calling if it is more than 30 days old.`
              : 'Do Not Call status was not checked: check the Do Not Call list before calling or texting.'}{' '}
            {out.chargedCents ? `${usd(out.chargedCents)} charged.` : 'No charge.'} Wallet balance {usd(out.balanceCents)}.
          </div>
        </div>
      ) : (
        <div className={muted}>No contact found for this owner. No charge.</div>
      )}
      {error && (
        <div className="mt-1 text-amber-500">
          {error.text}{error.funds && <> <Link href="/wallet" className="underline">Add funds</Link></>}
        </div>
      )}
    </div>
  );
}
