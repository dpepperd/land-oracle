'use client';

// Positive confirmation after checkout: shown once, when the dashboard opens with ?checkout=success.
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import type { BillingSummary } from '@/lib/billing-summary';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null);

export default function SubscriptionBanner() {
  const [show, setShow] = useState(false);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') !== 'success') return;
    setShow(true);
    let tries = 0, stop = false;
    const load = async () => {
      try {
        const r = await fetch('/api/billing/summary', { cache: 'no-store' });
        if (r.ok) {
          const s: BillingSummary = await r.json();
          if (s.active) { if (!stop) setSummary(s); return; }
        }
      } catch { /* retry below */ }
      if (++tries >= 6) { if (!stop) setGaveUp(true); return; }
      setTimeout(() => { if (!stop) load(); }, 3000);   // the plan can take a few seconds to appear
    };
    load();
    return () => { stop = true; };
  }, []);

  const dismiss = () => {
    setShow(false);
    const u = new URL(window.location.href);
    u.searchParams.delete('checkout'); u.searchParams.delete('session_id');
    window.history.replaceState({}, '', u.pathname + (u.search || ''));
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const r = await fetch('/api/billing/portal', { method: 'POST' });
      if (r.ok) { window.location.href = (await r.json()).url; return; }
    } catch { /* fall through */ }
    setPortalBusy(false);
    alert('Could not open billing right now. Try again in a moment, or contact support.');
  };

  if (!show) return null;

  if (!summary) {
    return (
      <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between" role="status">
        <span className="flex items-center gap-2 font-medium">
          {!gaveUp && <Loader2 size={16} className="animate-spin" />}
          {gaveUp ? 'Payment received. Your plan is still being set up; refresh in a minute, or contact support if it does not appear.' : 'Payment received. Setting up your plan...'}
        </span>
        <button onClick={dismiss} aria-label="Dismiss" className="text-blue-100 hover:text-white"><X size={18} /></button>
      </div>
    );
  }

  const renews = fmtDate(summary.renewsOn);
  const countyLine = summary.counties === 'all'
    ? 'All 67 Florida counties'
    : summary.allowance != null && summary.counties.length < summary.allowance
      ? `${summary.allowance} ${summary.allowance === 1 ? 'county' : 'counties'}: pick where you work to start searching`
      : `${summary.counties.length} ${summary.counties.length === 1 ? 'county' : 'counties'}: ${summary.counties.join(', ')}`;
  const exportsLine = summary.exportsPerMonth === 'unlimited' ? 'Unlimited CSV exports' : `${summary.exportsPerMonth?.toLocaleString('en-US')} CSV export rows a month`;

  return (
    <div className="bg-green-700 text-white px-6 py-4" role="status">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-base">You&apos;re subscribed to {summary.plan!.name}. Payment received, thank you.</p>
            <ul className="mt-1 text-sm text-green-50 space-y-0.5">
              <li>Billed {summary.interval === 'year' ? 'yearly' : 'monthly'}{renews ? `, next renewal ${renews}` : ''}</li>
              <li>{countyLine}</li>
              <li>{exportsLine}{summary.aiAnalyst ? ', AI Analyst included' : ''}</li>
              <li>{summary.email ? `Your receipt is emailed to ${summary.email}. ` : ''}All invoices are under Manage billing.</li>
            </ul>
            <button onClick={openPortal} disabled={portalBusy} className="mt-2 text-sm underline underline-offset-2 hover:text-white disabled:opacity-60">
              {portalBusy ? 'Opening...' : 'Manage billing and invoices'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-green-100 hover:text-white shrink-0"><X size={18} /></button>
      </div>
    </div>
  );
}
