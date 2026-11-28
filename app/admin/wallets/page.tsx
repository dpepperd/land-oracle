'use client';

// Admin: customer wallets. Totals, what needs a person (refunds and disputes we could not fully take back, open chargebacks, paused wallets),
// a searchable list, and one account's full history. The only writes are unpause, "dealt with" and adding or removing money by hand: each needs a note.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adjustWalletBalance, loadWalletDetail, loadWalletList, loadWalletOverview, resolveWalletIncident, unfreezeWallet } from './actions';

const usd = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');
const ITEM: Record<string, string> = {
  postcard_4x6: 'Postcard 4×6', postcard_6x9: 'Postcard 6×9', postcard_6x11: 'Postcard 6×11',
  skip_trace: 'Skip trace: contact', skip_trace_dnc: 'Skip trace: Do Not Call check', property_data: 'Property data', permit: 'Permit', monitor_alert: 'Monitor alert',
};
const label = (i: string | null) => (i ? ITEM[i] ?? i : '');
const KIND: Record<string, string> = {
  refund_shortfall: 'Refund we could not fully take back', dispute_open: 'Dispute open: respond in Stripe', dispute_shortfall: 'Dispute: part already spent',
  dispute_lost: 'Dispute LOST', manual: 'Manual change',
};

type Overview = Awaited<ReturnType<typeof loadWalletOverview>>;
type Rows = Awaited<ReturnType<typeof loadWalletList>>;
type Detail = NonNullable<Awaited<ReturnType<typeof loadWalletDetail>>>;
const newToken = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t${Date.now()}${Math.random().toString(36).slice(2)}`);

export default function AdminWalletsPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Rows | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adj, setAdj] = useState({ direction: 'add', dollars: '', reason: '' });
  const [token, setToken] = useState(newToken);

  const reloadOverview = useCallback(() => loadWalletOverview().then(setOv).catch(() => setFailed(true)), []);
  useEffect(() => { reloadOverview(); }, [reloadOverview]);
  const search = useCallback(() => { setBusy(true); loadWalletList(q, page).then(setRows).catch(() => setFailed(true)).finally(() => setBusy(false)); }, [q, page]);
  useEffect(() => { search(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: number) => loadWalletDetail(id).then((d) => { setDetail(d); setMsg(null); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); });
  const refreshAll = async (userId?: number) => { await Promise.all([reloadOverview(), search(), userId ? loadWalletDetail(userId).then(setDetail) : Promise.resolve()]); };
  const done = async (r: { ok: boolean; message: string }, userId?: number) => { setMsg({ ok: r.ok, text: r.message }); if (r.ok) await refreshAll(userId); };

  if (failed) return <div className="max-w-3xl mx-auto p-8 text-amber-400">Could not load the wallet data. If this is a new environment, the wallet migrations (017, 018, 020, 022) have not been run.</div>;
  if (!ov || !rows) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4';
  const th = 'text-left text-xs text-slate-400 font-normal py-1.5';
  const input = 'bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100';
  const ask = (q2: string) => { const t = window.prompt(q2); return t === null ? null : t.trim(); };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-slate-200">
      <h1 className="text-xl font-semibold">Customer wallets</h1>
      {msg && <div className={`text-sm rounded px-3 py-2 border ${msg.ok ? 'bg-emerald-900/30 border-emerald-700' : 'bg-amber-900/30 border-amber-700'}`}>{msg.text}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}><div className="text-xs text-slate-400">Customer money held (we owe this)</div><div className="text-2xl font-bold">{usd(ov.balanceCents)}</div><div className="text-xs text-slate-500">{ov.wallets} wallet{ov.wallets === 1 ? '' : 's'}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Set aside for services in progress</div><div className="text-2xl font-bold">{usd(ov.heldCents)}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Top-ups, last 30 days</div><div className="text-2xl font-bold text-emerald-400">{usd(ov.topups30dCents)}</div></div>
        <div className={card}><div className="text-xs text-slate-400">Spent on services, last 30 days</div><div className="text-2xl font-bold text-amber-400">{usd(ov.spend30dCents)}</div>{ov.adjustments30dCents !== 0 && <div className="text-xs text-slate-500">Refunds, disputes and adjustments {usd(ov.adjustments30dCents)}</div>}</div>
      </div>

      {ov.incidents.length > 0 && (
        <section className="bg-red-950/40 border border-red-800 rounded-xl p-4">
          <h2 className="font-semibold text-red-300 mb-1">Refunds and disputes that need you ({ov.incidents.length})</h2>
          <p className="text-xs text-red-200/80 mb-2">Open chargebacks (reply in the Stripe dashboard before the evidence date), lost disputes, and money we could not take back from a customer.</p>
          <div className="space-y-2">
            {ov.incidents.map((i) => (
              <div key={i.id} className="border-t border-red-900 pt-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><b>{KIND[i.kind] ?? i.kind}</b> · {usd(i.cents)} · <button className="underline" onClick={() => open(i.userId)}>{i.email ?? `user ${i.userId}`}</button></span>
                  <span className="text-xs text-slate-400">{day(i.createdAt)}</span>
                </div>
                {i.note && <div className="text-xs text-slate-300 mt-0.5">{i.note}</div>}
                <button className="text-xs text-blue-300 underline mt-1" onClick={async () => { const note = ask('What was done about this? (3 to 200 characters)'); if (note) await done(await resolveWalletIncident(i.id, note), detail?.user.id); }}>Mark as dealt with</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {ov.frozen.length > 0 && (
        <section className="bg-amber-950/40 border border-amber-700 rounded-xl p-4">
          <h2 className="font-semibold text-amber-300 mb-1">Paused wallets ({ov.frozen.length})</h2>
          <p className="text-xs text-amber-200/80 mb-2">These customers cannot start new spending or top up. A wallet pauses when a dispute opens and un-pauses by itself if you win it. After a lost dispute you decide.</p>
          <table className="w-full text-sm"><tbody>
            {ov.frozen.map((f) => (
              <tr key={f.userId} className="border-t border-amber-900">
                <td className="py-1.5"><button className="underline" onClick={() => open(f.userId)}>{f.email ?? `user ${f.userId}`}</button></td>
                <td className="text-slate-400 text-xs">{f.reason?.startsWith('dispute:') ? `dispute ${f.reason.slice(8)}` : f.reason}</td>
                <td className="text-right text-slate-400 text-xs">since {day(f.since)}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}

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
          <input className={input + ' flex-1'} placeholder="Search by email (2 or more characters)" value={q} onChange={(e) => setQ(e.target.value)} />
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
          {detail.frozen.frozen && (
            <div className="bg-amber-950/40 border border-amber-700 rounded p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <span>Wallet paused since {day(detail.frozen.since)} ({detail.frozen.reason?.startsWith('dispute:') ? `dispute ${detail.frozen.reason.slice(8)}` : detail.frozen.reason}). The customer cannot start spending or top up.</span>
              <button className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded" onClick={async () => { const note = ask('Why is it safe to un-pause this wallet? (3 to 200 characters)'); if (note) await done(await unfreezeWallet(detail.user.id, note), detail.user.id); }}>Un-pause</button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><div className="text-xs text-slate-400">Balance</div><div className="font-bold">{usd(detail.balanceCents)}</div></div>
            <div><div className="text-xs text-slate-400">Held</div><div className="font-bold">{usd(detail.heldCents)}</div></div>
            <div><div className="text-xs text-slate-400">Spendable</div><div className="font-bold">{usd(detail.spendableCents)}</div></div>
            <div><div className="text-xs text-slate-400">Topped up (all time)</div><div className="font-bold text-emerald-400">{usd(detail.topupCents)}</div></div>
            <div><div className="text-xs text-slate-400">Spent (all time)</div><div className="font-bold text-amber-400">{usd(detail.spentCents)}</div></div>
          </div>
          {detail.spendByItem.length > 0 && <div className="text-sm text-slate-300">{detail.spendByItem.map((s) => `${label(s.item)}: ${s.count} for ${usd(s.cents)}`).join(' · ')}</div>}

          <form className="border border-slate-800 rounded p-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            const r = await adjustWalletBalance(detail.user.id, adj.direction, adj.dollars, adj.reason, token);
            await done(r, detail.user.id);
            if (r.ok) { setAdj({ direction: 'add', dollars: '', reason: '' }); setToken(newToken()); }
          }}>
            <h3 className="text-sm font-semibold">Add or remove money by hand</h3>
            <div className="flex flex-wrap gap-2">
              <select className={input} value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value })}><option value="add">Add</option><option value="remove">Remove</option></select>
              <input className={input + ' w-28'} inputMode="decimal" placeholder="5.00" value={adj.dollars} onChange={(e) => setAdj({ ...adj, dollars: e.target.value })} />
              <input className={input + ' flex-1 min-w-48'} placeholder="Reason (the customer sees it in their history)" maxLength={200} value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded">Apply</button>
            </div>
            <p className="text-xs text-slate-500">At most $1,000 at a time. Removing cannot take money that is set aside for a service in progress. Every change is recorded with your name.</p>
          </form>

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
          {detail.topups.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Top-up payments (latest 20)</h3>
              <table className="w-full text-sm"><tbody>
                {detail.topups.map((t) => (
                  <tr key={t.paymentIntent} className="border-t border-slate-800">
                    <td className="py-1.5 text-slate-400 text-xs whitespace-nowrap">{day(t.createdAt)}</td>
                    <td className="text-slate-500 text-xs">{t.paymentIntent}{t.livemode ? '' : ' · test'}</td>
                    <td className="text-right">{usd(t.cents)}</td>
                    <td className="text-right text-xs">{t.refundedCents ? <span className="text-amber-400">refunded {usd(t.refundedCents)}</span> : ''}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
          {detail.disputes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Disputes</h3>
              <table className="w-full text-sm"><tbody>
                {detail.disputes.map((d) => (
                  <tr key={d.stripeId} className="border-t border-slate-800">
                    <td className="py-1.5 text-slate-400 text-xs whitespace-nowrap">{day(d.createdAt)}</td>
                    <td className="text-slate-500 text-xs">{d.stripeId} · {d.reason}</td>
                    <td className="text-right">{usd(d.cents)}</td>
                    <td className="text-right text-xs"><span className={d.status === 'lost' ? 'text-red-400' : d.status === 'open' ? 'text-amber-400' : 'text-slate-400'}>{d.status}</span> · taken back {usd(d.debitedCents)}{d.shortfallCents ? ` · could not take ${usd(d.shortfallCents)}` : ''}{d.reinstatedCents ? ` · returned ${usd(d.reinstatedCents)}` : ''}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
          {detail.incidents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Incidents and manual changes</h3>
              <table className="w-full text-sm"><tbody>
                {detail.incidents.map((i) => (
                  <tr key={i.id} className="border-t border-slate-800 align-top">
                    <td className="py-1.5 text-slate-400 text-xs whitespace-nowrap">{day(i.createdAt)}</td>
                    <td>{KIND[i.kind] ?? i.kind}<div className="text-xs text-slate-400">{i.note}</div>{i.resolution && <div className="text-xs text-slate-500">Resolved: {i.resolution}</div>}</td>
                    <td className="text-right">{i.cents ? usd(i.cents) : ''}</td>
                    <td className="text-right text-xs"><span className={i.status === 'open' ? 'text-amber-400' : 'text-slate-500'}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
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
