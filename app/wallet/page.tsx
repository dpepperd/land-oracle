'use client';

// Wallet: balance, top-up and history. Postcards are sent from /postcards. Shown only to admins until WALLET_ENABLED=true (the API says enabled:false otherwise).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const usd = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;

export default function WalletPage() {
  const [data, setData] = useState<any>(null);
  const [custom, setCustom] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch('/api/wallet').then((r) => r.json()).then(setData).catch(() => setData({ enabled: false })), []);
  useEffect(() => { load(); if (new URLSearchParams(window.location.search).get('topup') === 'success') setMsg({ ok: true, text: 'Payment received. Your balance updates in a few seconds.' }); }, [load]);

  const topup = async (amountCents: number) => {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.url) window.location.href = j.url; else setMsg({ ok: false, text: j.message || 'Could not start the top-up.' });
  };

  if (!data) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  if (!data.enabled) return <div className="max-w-xl mx-auto p-8 text-slate-300">The wallet is not available yet.</div>;
  const input = 'w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm';
  const customCents = Math.round(Number(custom) * 100);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 text-slate-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-sm text-slate-400">Wallet balance</div>
        <div className="text-3xl font-bold">{usd(data.balanceCents)}</div>
        <p className="text-xs text-slate-400 mt-1">Prepaid. Billed by {data.billingEntity}. Test mode only for now: no real money moves.</p>
        <Link href="/postcards" className="inline-block mt-3 text-sm text-blue-400 hover:underline">Send a postcard</Link>
      </div>

      {msg && <div className={`text-sm rounded px-3 py-2 border ${msg.ok ? 'bg-emerald-900/30 border-emerald-700' : 'bg-amber-900/30 border-amber-700'}`}>{msg.text}</div>}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Add funds</h2>
        <div className="flex flex-wrap gap-2">
          {data.packsCents.map((c: number) => <button key={c} disabled={busy} onClick={() => topup(c)} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">{usd(c)}</button>)}
        </div>
        <div className="flex gap-2 items-center">
          <input className={input + ' !w-32'} inputMode="decimal" placeholder={`Other (min ${usd(data.minTopupCents)})`} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button disabled={busy || !(customCents >= data.minTopupCents)} onClick={() => topup(customCents)} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">Add</button>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold mb-2">History</h2>
        {data.ledger.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {data.ledger.map((l: any) => (
                <tr key={l.id} className="border-t border-slate-800">
                  <td className="py-1.5 text-slate-400">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td>{l.description || l.kind}</td>
                  <td className={`text-right ${l.amount_cents < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{usd(l.amount_cents)}</td>
                  <td className="text-right text-slate-400">{usd(l.balance_after_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
