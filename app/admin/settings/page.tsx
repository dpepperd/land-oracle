'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadSettings, savePrices, saveReturnAddress } from './actions';

const LABELS: Record<string, string> = {
  postcard_4x6: 'Postcard 4×6', postcard_6x9: 'Postcard 6×9', postcard_6x11: 'Postcard 6×11',
  skip_trace: 'Skip trace', property_data: 'Property data', permit: 'Permit', monitor_alert: 'Monitor alert',
};
const PLACEHOLDERS = new Set(['skip_trace', 'property_data', 'permit', 'monitor_alert']); // nothing uses these yet
const EMPTY_ADDR = { name: '', address_line1: '', address_line2: '', city: '', state: '', zip: '' };

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, { dollars: string; enabled: boolean }>>({});
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [msg, setMsg] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      if (s.prices) setRows(Object.fromEntries(Object.entries(s.prices).map(([k, v]) => [k, { dollars: (v.cents / 100).toFixed(2), enabled: v.enabled }])));
      else setBroken(true);
      if (s.returnAddress) setAddr({ ...EMPTY_ADDR, ...s.returnAddress });
      setLoading(false);
    });
  }, []);

  const note = (r: { success: boolean; error?: string }, ok: string) => setMsg(r.success ? ok : r.error ?? 'Could not save.');

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  const input = 'w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 text-slate-200">
      <h1 className="text-xl font-semibold">Wallet settings</h1>
      {msg && <div className="text-sm bg-slate-800 border border-slate-700 rounded px-3 py-2">{msg}</div>}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Prices (US dollars per use)</h2>
        {broken && <p className="text-amber-400 text-sm">Prices are not set up in the database yet (run migrations 017 and 018). Nothing can be charged until they are.</p>}
        {Object.keys(LABELS).map((k) => (
          <div key={k} className="flex items-center justify-between gap-4 text-sm">
            <span>{LABELS[k]}{PLACEHOLDERS.has(k) && <span className="text-slate-500 text-xs ml-2">placeholder, no feature uses it yet</span>}</span>
            <span className="flex items-center gap-3">
              <input className={input + ' !w-24 text-right'} inputMode="decimal" value={rows[k]?.dollars ?? ''} onChange={(e) => setRows({ ...rows, [k]: { ...rows[k], dollars: e.target.value } })} />
              <label className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={!!rows[k]?.enabled} onChange={(e) => setRows({ ...rows, [k]: { ...rows[k], enabled: e.target.checked } })} /> on</label>
            </span>
          </div>
        ))}
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded" onClick={async () => note(await savePrices(rows), 'Prices saved.')}>Save prices</button>
        <p className="text-xs text-slate-400">Changes apply to future charges only. A price that is switched off cannot be charged. Past charges keep the price they were made at.</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Postcard return address</h2>
        <p className="text-xs text-slate-400">Printed on every postcard. Postcards stay blocked until this is filled in.</p>
        <input className={input} placeholder="Name" value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} />
        <input className={input} placeholder="Street address" value={addr.address_line1} onChange={(e) => setAddr({ ...addr, address_line1: e.target.value })} />
        <input className={input} placeholder="Suite / unit (optional)" value={addr.address_line2} onChange={(e) => setAddr({ ...addr, address_line2: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <input className={input} placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
          <input className={input} placeholder="State" maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
          <input className={input} placeholder="ZIP" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded" onClick={async () => note(await saveReturnAddress(addr), 'Return address saved.')}>Save address</button>
      </section>
    </div>
  );
}
