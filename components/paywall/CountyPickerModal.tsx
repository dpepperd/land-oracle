'use client';

// Picks the counties a subscriber's plan allows (base + add-ons). Statewide/admin never see it.
// Shown when: slots are unfilled, or a downgrade trimmed the selection (needsCountyRepick).
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, X } from 'lucide-react';
import { checkEntitlementsAction, setCountiesAction } from '@/app/actions/territories';
import { FLORIDA_COUNTIES, canonCounty } from '@/lib/counties';

export default function CountyPickerModal() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allowance, setAllowance] = useState(1);
  const [repick, setRepick] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hadSelection, setHadSelection] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    checkEntitlementsAction().then((ent) => {
      if (!ent || ent.counties === 'all') return;
      const cur = ent.counties.map((c) => FLORIDA_COUNTIES.find((f) => canonCounty(f) === canonCounty(c)) ?? c);
      setAllowance(ent.allowance); setRepick(ent.needsCountyRepick); setSelected(cur); setHadSelection(cur.length > 0);
      if (ent.needsCountyRepick || cur.length < ent.allowance) setOpen(true);
    }).catch((e) => console.error('Entitlement check failed', e));
  }, [isLoaded, userId]);

  const list = useMemo(() => FLORIDA_COUNTIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const full = selected.length >= allowance;
  const toggle = (c: string) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length >= allowance ? s : [...s, c]));

  const save = async () => {
    setBusy(true); setError(null);
    const res = await setCountiesAction(selected);
    if (res.success) { setOpen(false); router.refresh(); } else { setError(res.error || 'Could not save your counties.'); setBusy(false); }
  };

  if (!open) return null;
  const canDismiss = hadSelection;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 pb-3 relative text-center">
          {canDismiss && <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Close"><X size={20} /></button>}
          <h2 className="text-2xl font-bold text-white mb-1">{repick ? 'Re-pick your counties' : 'Choose your counties'}</h2>
          <p className="text-slate-400 text-sm">
            {repick
              ? `Your plan changed and now includes ${allowance} ${allowance === 1 ? 'county' : 'counties'}. We kept your first selections; adjust them below.`
              : `Your plan includes ${allowance} ${allowance === 1 ? 'county' : 'counties'}. Pick where you work; you can change them later.`}
          </p>
          <p className="mt-2 text-blue-400 text-sm font-semibold">{selected.length} of {allowance} selected</p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search counties..." className="mt-3 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60" />
        </div>
        <div className="px-6 py-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((c) => {
            const on = selected.includes(c); const disabled = !on && full;
            return (
              <button key={c} onClick={() => toggle(c)} disabled={disabled}
                className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm transition ${on ? 'bg-blue-600/20 border-blue-500 text-white' : disabled ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                <MapPin size={14} className={on ? 'text-blue-400' : 'text-slate-500'} /> {c}
              </button>
            );
          })}
        </div>
        <div className="p-6 pt-3 border-t border-slate-800">
          {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}
          <button onClick={save} disabled={busy || selected.length === 0}
            className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2">
            {busy && <Loader2 size={16} className="animate-spin" />} Save counties
          </button>
        </div>
      </div>
    </div>
  );
}
