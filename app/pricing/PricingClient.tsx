"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import Header from "@/components/dashboard/Header";
import { ADDON, FOUNDING, PLANS, annualPerMonth, maxAddonCounties, type Interval, type PlanId } from "@/lib/plans";

const usd = (n: number) => `$${n.toLocaleString()}`;

// Only features that exist in the app today (see report for what was left out).
function features(id: PlanId, aiEnabled: boolean, aiQuestions: { pro: number; statewide: number }): { text: string; soon?: boolean }[] {
  const p = PLANS[id];
  return [
    { text: p.counties === 'all' ? 'All 67 Florida counties' : `${p.counties} Florida ${p.counties === 1 ? 'county' : 'counties'} of your choice` },
    { text: p.exportsPerMonth === 'unlimited' ? 'Unlimited CSV exports' : `CSV exports: ${p.exportsPerMonth.toLocaleString()} rows/month` },
    { text: 'Owner + mailing address from county tax rolls' },
    { text: 'Recent qualified sales (2026 tax roll)' },
    { text: 'FEMA flood zone map overlay' },
    ...(p.ai ? [{ text: `AI research assistant (${(id === 'statewide' ? aiQuestions.statewide : aiQuestions.pro).toLocaleString()} questions/month)`, soon: !aiEnabled }] : []),
  ];
}

export default function PricingClient({ aiEnabled, founding, aiQuestions }: { aiEnabled: boolean; founding: boolean; aiQuestions: { pro: number; statewide: number } }) {
  const { isSignedIn } = useAuth();
  const [billing, setBilling] = useState<Interval>('month');
  const [addons, setAddons] = useState<Record<string, number>>({ scout: 0, pro: 0 });
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async (plan: PlanId) => {
    if (!isSignedIn) { window.location.assign(`/sign-in?redirect_url=${encodeURIComponent('/pricing')}`); return; }
    setBusy(plan); setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: billing, addonCounties: addons[plan] ?? 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.assign(data.url); return; }
      setError(data.error || 'Could not start checkout. Please try again.');
    } catch { setError('Network error. Please try again.'); }
    setBusy(null);
  };

  const addonPrice = billing === 'month' ? ADDON.monthly : ADDON.annual;
  const per = billing === 'month' ? 'mo' : 'yr';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Choose Your <span className="text-blue-600 dark:text-blue-400">Territory</span></h1>
          <p className="text-xl text-muted-foreground mb-8">Florida parcel intelligence from 2026 county roll data. Pay only for the counties you need.</p>

          {founding && (
            <div className="mb-8 mx-auto max-w-2xl rounded-2xl border border-amber-400/60 bg-amber-500/10 px-5 py-3 text-sm md:text-base font-medium text-amber-700 dark:text-amber-300">
              Founding Member: {FOUNDING.percentOff}% off for as long as your subscription stays active — first {FOUNDING.maxRedemptions} subscribers. Code <span className="font-mono font-bold">{FOUNDING.code}</span>.
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billing === 'month' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button onClick={() => setBilling(billing === 'month' ? 'year' : 'month')} aria-label="Toggle billing interval" className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full relative transition p-1 cursor-pointer">
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${billing === 'year' ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium ${billing === 'year' ? 'text-foreground' : 'text-muted-foreground'}`}>Annual — 2 months free</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
          {Object.values(PLANS).map((p) => {
            const best = p.id === 'pro';
            const price = billing === 'month' ? p.monthly : p.annual;
            const q = addons[p.id] ?? 0;
            return (
              <div key={p.id} className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 ${best ? 'bg-card border-amber-400 dark:border-amber-500 shadow-2xl md:scale-105 z-10' : 'bg-card border-border shadow-lg hover:shadow-xl'}`}>
                {best && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md whitespace-nowrap">BEST VALUE</div>}
                <h3 className="text-xl font-bold mb-2">{p.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{usd(price)}</span>
                  <span className="text-muted-foreground font-medium">/{per}</span>
                </div>
                <p className="text-xs text-muted-foreground h-5 mt-1">{billing === 'year' && `(=${usd(annualPerMonth(price))}/mo)`}</p>

                <div className="flex-1 space-y-3 my-6">
                  {features(p.id, aiEnabled, aiQuestions).map((f) => (
                    <div key={f.text} className="flex items-start gap-3">
                      <Check className="w-5 h-5 shrink-0 text-blue-500" />
                      <span className="text-sm text-foreground/80 leading-snug">
                        {f.text}
                        {f.soon && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Coming soon</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {p.addonAllowed ? (
                  <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-sm">
                    <span className="text-foreground/80">Extra counties<br /><span className="text-xs text-muted-foreground">{usd(addonPrice)}/{per} each</span></span>
                    <span className="flex items-center gap-2">
                      <button onClick={() => setAddons({ ...addons, [p.id]: Math.max(0, q - 1) })} className="p-1 rounded-full border border-border hover:bg-background" aria-label="Fewer counties"><Minus size={14} /></button>
                      <span className="w-5 text-center font-semibold">{q}</span>
                      <button onClick={() => setAddons({ ...addons, [p.id]: Math.min(maxAddonCounties(p.id), q + 1) })} className="p-1 rounded-full border border-border hover:bg-background" aria-label="More counties"><Plus size={14} /></button>
                    </span>
                  </div>
                ) : <div className="mb-5 h-[52px]" />}

                <button onClick={() => subscribe(p.id)} disabled={busy !== null}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-base transition-all cursor-pointer flex items-center justify-center gap-2 ${best ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg ring-4 ring-amber-500/20' : 'bg-foreground text-background hover:opacity-90'} disabled:opacity-60`}>
                  {busy === p.id && <Loader2 className="animate-spin" size={18} />}
                  {q > 0 ? `Subscribe: ${usd(price + q * addonPrice)}/${per}` : `Get ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-6 text-center text-sm text-red-500">{error}</p>}

        <div className="mt-16 text-center space-y-2">
          <p className="text-muted-foreground text-sm">Secure payments processed by <span className="font-bold text-foreground">Stripe</span>. Cancel anytime. New subscribers get a 7-day money-back guarantee on their first payment: see the{' '}<Link href="/refund-policy" className="underline hover:text-foreground">Refund Policy</Link>.</p>
          <p className="text-muted-foreground text-xs">
            Data is from the 2026 Florida DOR tax roll. Verify before transacting.{' '}
            <Link href="/data-disclaimer" className="underline hover:text-foreground">Read the data disclaimer</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
