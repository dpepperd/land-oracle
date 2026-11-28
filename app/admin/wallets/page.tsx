'use client';

// Admin: customer wallets. Read-only: totals, accounts that need a person to look, a searchable list, and one account's full history.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadWalletDetail, loadWalletList, loadWalletOverview } from './actions';

const usd = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');
const ITEM: Record<string, string> = {
  postcard_4x6: 'Postcard 4×6', postcard_6x9: 'Postcard 6×9', postcard_6x11: 'Postcard 6×11',
  skip_trace: 'Skip trace: contact', skip_trace_dnc: 'Skip trace: Do Not Call check', property_data: 'Property data', permit: 'Permit', monitor_alert: 'Monitor alert',
};
const label = (i: string | null) => (i ? ITEM[i] ?? i : '');

type Overview = Awaited<ReturnType<typeof loadWalletOverview>>;
type Rows = Awaited<ReturnType<typeof loadWalletList>>;
type Detail = NonNullable<Awaited<ReturnType<typeof loadWalletDetail>>>;

export default function AdminWalletsPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Rows | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { loadWalletOverview().then(setOv).catch(() => setFailed(true)); }, []);
  const search = useCallback(() => { setBusy(true); loadWalletList(q, page).then(setRows).catch(() => setFailed(true)).finally(() => setBusy(false)); }, [q, page]);
  useEffect(() => { search(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: number) => loadWalletDetail(id).then((d) => { setDetail(d); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); });

  if (failed) return <div className="max-w-3xl mx-auto p-8 text-amber-400">Could not load the wallet data. If this is a new environment, the wallet migrations (017, 018, 020) have not been run.</div>;
  if (!ov || !rows) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4';
  const th = 'text-left text-xs text-slate-400 font-normal py-1.5';

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-slate-200">
      <h1 className="text-xl font-semibold">Customer wallets</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}><div className="text-xs text-slate-400">Customer money held (we owe this)</div><div className="text-2xl font-bold">{usd(ov.balanceCents)}</div><div className="text-xs text-slate-500">{ov.wallets} wallet{ov.wallets === 1 ? '' : 's'}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Set aside for services in progress</div><div className="text-2xl font-bold">{usd(ov.heldCents)}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Top-ups, last 30 days</div><div className="text-2xl font-bold text-emerald-400">{usd(ov.topups30dCents)}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Spent on services, last 30 days</div><div className="text-2xl font-bold text-amber-400">{usd(ov.spend30dCents)}</div>{ov.adjustments30dCents !== 0 && <div className="text-xs text-slate-500">Refunds and adjustments {usd(ov.adjustments30dCents)}</div>}</div>
      </div>

      {ov.needsAttention.length > 0 && (
        <section className="bg-amber-950/40 border border-amber-700 rounded-xl p-4">
          <h2 className="font-semibold text-amber-300 mb-1">Needs a person to look ({ov.needsAttention.length})</h2>
          <p className="text-xs text-amber-200/80 mb-2">A service was delivered but its charge did not complete, so the money is still set aside. It does not release on its own.</p>
          <table className="w-full text-sm"><tbody>
            {ov.needsAttention.map((h) => (
              <tr key={h.holdId} className="border-t border-amber-900">
                <td className="py-1.5"><button className="underline" onClick={() => open(h.userId)}>{h.email ?? `user ${h.userId}`}</button></td>
                <td>{label(h.item)}</td><td className="text-right">{usd(h.cents)}</td><td className="text-right text-slate-400">{day(h.createdAt)}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}
      {ov.expiredOpen.count > 0 && <p className="text-xs text-slate-500">{ov.expiredOpen.count} expired hold{ov.expiredOpen.count === 1 ? '' : 's'} ({usd(ov.expiredOpen.cents)}) will free themselves the next time that account spends.</p>}

      <section className={card}>
        <h2 className="font-semibold mb-2">Spending by service, last 30 days</h2>
        {ov.byItem30d.length === 0 ? <p className="text-sm text-slate-400">No charges yet.</p> : (
          <table className="w-full text-sm"><thead><tr><th className={th}>Service</th><th className={th + ' text-right'}>Uses</th><th className={th + ' text-right'}>Amount</th></tr></thead><tbody>
            {ov.byItem30d.map((r) => <tr key={r.item} className="border-t border-slate-800"><td className="py-1.5">{label(r.item)}</td><td className="text-right">{r.count}</td><td className="text-right">{usd(r.cents)}</td></tr>)}
          </tbody></table>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold mb-2">Wallets</h2>
        <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); if (page === 0) search(); else setPage(0); }}>
          <input className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm flex-1" placeholder="Search by email (2 or more characters)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded" disabled={busy}>Search</button>
        </form>
        {rows.length === 0 ? <p className="text-sm text-slate-400">No wallets found.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Account</th><th className={th + ' text-right'}>Balance</th><th className={th + ' text-right'}>Held</th><th className={th + ' text-right'}>Topped up</th><th className={th + ' text-right'}>Spent</th><th className={th + ' text-right'}>Last activity</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer" onClick={() => open(r.userId)}>
                  <td className="py-1.5">{r.email ?? `user ${r.userId}`}<span className="text-slate-500 text-xs ml-2">{r.tier}</span></td>
                  <td className="text-right">{usd(r.balanceCents)}</td><td className="text-right text-slate-400">{r.heldCents ? usd(r.heldCents) : ''}</td>
                  <td className="text-right text-emerald-400">{usd(r.topupCents)}</td><td className="text-right text-amber-400">{usd(r.spentCents)}</td>
                  <td className="text-right text-slate-400 text-xs">{day(r.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-between mt-3 text-sm">
          <button disabled={page === 0 || busy} onClick={() => setPage(page - 1)} className="text-blue-400 disabled:text-slate-600">Previous</button>
          <button disabled={rows.length < 50 || busy} onClick={() => setPage(page + 1)} className="text-blue-400 disabled:text-slate-600">Next</button>
        </div>
      </section>

      {detail && (
        <section className={card + ' space-y-4'}>
          <div className="flex items-start justify-between">
            <div><h2 className="font-semibold">{detail.user.email ?? `user ${detail.user.id}`}</h2><div className="text-xs text-slate-400">{detail.user.tier} · {detail.user.status ?? 'no subscription'}</div></div>
            <button className="text-xs text-slate-400 hover:text-white" onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><div className="text-xs text-slate-400">Balance</div><div className="font-bold">{usd(detail.balanceCents)}</div></div>
            <div><div className="text-xs text-slate-400">Held</div><div className="font-bold">{usd(detail.heldCents)}</div></div>
            <div><div className="text-xs text-slate-400">Spendable</div><div className="font-bold">{usd(detail.spendableCents)}</div></div>
            <div><div className="text-xs text-slate-400">Topped up (all time)</div><div className="font-bold text-emerald-400">{usd(detail.topupCents)}</div></div>
            <div><div className="text-xs text-slate-400">Spent (all time)</div><div className="font-bold text-amber-400">{usd(detail.spentCents)}</div></div>
          </div>
          {detail.spendByItem.length > 0 && <div className="text-sm text-slate-300">{detail.spendByItem.map((s) => `${label(s.item)}: ${s.count} for ${usd(s.cents)}`).join(' · ')}</div>}
          <div>
            <h3 className="text-sm font-semibold mb-1">History (latest 100)</h3>
            <table className="w-full text-sm"><tbody>
              {detail.ledger.map((l) => (
                <tr key={l.id} className="border-t border-slate-800">
                  <td className="py-1.5 text-slate-400 text-xs whitespace-nowrap">{day(l.createdAt)}</td>
                  <td>{l.description || label(l.item) || l.kind}<span className="text-slate-500 text-xs ml-2">{l.kind}{l.ref ? ` · ${l.ref}` : ''}</span></td>
                  <td className={`text-right ${l.amountCents < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{usd(l.amountCents)}</td>
                  <td className="text-right text-slate-400">{usd(l.balanceAfterCents)}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          {detail.holds.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Holds (latest 30)</h3>
              <table className="w-full text-sm"><tbody>
                {detail.holds.map((h) => (
                  <tr key={h.id} className="border-t border-slate-800">
                    <td className="py-1.5 text-slate-400 text-xs whitespace-nowrap">{day(h.createdAt)}</td>
                    <td>{label(h.item)}</td><td className="text-right">{usd(h.cents)}</td>
                    <td className="text-right text-xs"><span className={h.status === 'held' ? 'text-amber-400' : 'text-slate-400'}>{h.status}</span>{h.note ? <span className="text-slate-500"> · {h.note}</span> : null}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
