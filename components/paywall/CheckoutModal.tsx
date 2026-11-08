"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { ADDON, PLANS, annualPerMonth, type Interval, type PlanId } from "@/lib/plans";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCounties: string[];
}

const usd = (n: number) => `$${n.toLocaleString()}`;

export default function CheckoutModal({ isOpen, onClose, selectedCounties }: CheckoutModalProps) {
  const n = Math.max(1, selectedCounties.length);
  const [interval, setInterval] = useState<Interval>('month');
  const [choice, setChoice] = useState<PlanId | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => (['scout', 'pro', 'statewide'] as PlanId[]).map((id) => {
    const p = PLANS[id];
    const included = p.counties === 'all' ? 67 : p.counties;
    const addons = p.counties === 'all' ? 0 : Math.max(0, n - included);
    const base = interval === 'month' ? p.monthly : p.annual;
    const add = interval === 'month' ? ADDON.monthly : ADDON.annual;
    return { id, name: p.name, addons, total: base + addons * add, included };
  }), [n, interval]);

  const selected = options.find((o) => o.id === (choice ?? 'pro')) ?? options[1];

  if (!isOpen) return null;

  const checkout = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected.id, interval, addonCounties: selected.addons }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(res.status === 401 ? 'Please sign in to subscribe.' : data.error || 'Could not start checkout.');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Choose your plan</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">You selected <b>{n}</b> {n === 1 ? 'county' : 'counties'}. Counties are chosen after checkout.</p>
          <div className="flex gap-2 text-sm">
            {(['month', 'year'] as Interval[]).map((i) => (
              <button key={i} onClick={() => setInterval(i)} className={`flex-1 py-2 rounded-lg border font-medium ${interval === i ? 'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {i === 'month' ? 'Monthly' : 'Annual: 2 months free'}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {options.map((o) => (
              <button key={o.id} onClick={() => setChoice(o.id)} className={`w-full text-left p-3 rounded-xl border transition ${selected.id === o.id ? 'border-blue-600 bg-blue-600/5' : 'border-slate-300 dark:border-slate-700'}`}>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-white"><span>{o.name}{o.id === 'pro' && <span className="ml-2 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full align-middle">BEST VALUE</span>}</span>
                  <span>{usd(o.total)}/{interval === 'month' ? 'mo' : 'yr'}</span></div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {o.id === 'statewide' ? 'All 67 counties' : `${o.included} included${o.addons ? ` + ${o.addons} add-on ${o.addons === 1 ? 'county' : 'counties'}` : ''}`}
                  {interval === 'year' && ` (= ${usd(annualPerMonth(o.total))}/mo)`}
                </div>
              </button>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>I agree to the <a href="/terms" target="_blank" className="underline text-blue-600">Terms</a> and the <a href="/data-disclaimer" target="_blank" className="underline text-blue-600">Data Disclaimer</a>, including that I am responsible for DNC/TCPA compliance on any outreach, and I authorize recurring {interval === 'month' ? 'monthly' : 'annual'} billing of <b>{usd(selected.total)}</b>. Cancel anytime.</span>
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={checkout} disabled={!agreed || loading} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${agreed && !loading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Continue to secure checkout
          </button>
          <p className="text-[11px] text-center text-slate-500">Payments by Stripe. Promo codes can be entered at checkout.</p>
        </div>
      </div>
    </div>
  );
}
