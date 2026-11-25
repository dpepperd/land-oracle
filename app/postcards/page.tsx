'use client';

// Send a postcard: pick a size and design, fill in the card, preview the exact front and back, then send.
// Shown only to admins until WALLET_ENABLED=true (the wallet API says enabled:false otherwise).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { DESIGNS, MERGE_FIELDS, SIZES, SIZE_SPECS, applyMerge, messageMax, renderPostcard, type DesignId, type PostcardSize } from '@/lib/wallet/templates';

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const SAVED_KEY = 'landoracle.postcard.agent';
const DEFAULT_MESSAGE = 'Hello {{owner_name}}, I am a local agent interested in your {{acreage}} acres at {{property_address}}. If you have ever thought about selling, I would be glad to make you a fair, no-obligation offer. Please call me any time.';
const SAMPLE = { ownerName: 'Pat Owner', propertyAddress: '123 County Road 4, Tampa, FL', acreage: 12.5 };

/** One card side, scaled to fit. The HTML is the same HTML Lob prints. */
function Side({ html, w, h, width }: { html: string; w: number; h: number; width: number }) {
  const px = w * 96; const scale = width / px;
  return (
    <div style={{ width, height: h * 96 * scale }} className="relative overflow-hidden rounded border border-slate-700 bg-white shrink-0">
      <iframe title="postcard" sandbox="" srcDoc={html} scrolling="no" style={{ width: px, height: h * 96, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }} />
    </div>
  );
}

export default function PostcardsPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [size, setSize] = useState<PostcardSize>('4x6');
  const [design, setDesign] = useState<DesignId>('classic');
  const [agent, setAgent] = useState({ name: '', phone: '', brokerage: '' });
  const [to, setTo] = useState({ name: '', line1: '', line2: '', city: '', state: '', zip: '' });
  const [propertyAddress, setPropertyAddress] = useState('');
  const [acreage, setAcreage] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [logo, setLogo] = useState<{ id: number; name: string; warnings: string[] } | null>(null);
  const [photo, setPhoto] = useState<{ id: number; name: string; warnings: string[] } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null); const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/wallet').then((r) => r.json()).then(setWallet).catch(() => setWallet({ enabled: false }));
    try { const s = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); if (s) setAgent(s); } catch { /* ignore */ }
    const q = new URLSearchParams(window.location.search); // optional prefill from a parcel: ?owner=&address=&acres=
    if (q.get('owner')) setTo((t) => ({ ...t, name: q.get('owner')! }));
    if (q.get('address')) setPropertyAddress(q.get('address')!);
    if (q.get('acres')) setAcreage(q.get('acres')!);
  }, []);
  useEffect(() => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(agent)); } catch { /* ignore */ } }, [agent]);

  const acreNum = acreage.trim() === '' ? undefined : Number(acreage);
  const body = useMemo(() => ({ size, design, message, agent, to, propertyAddress: propertyAddress.trim() || undefined, acreage: acreNum !== undefined && Number.isFinite(acreNum) ? acreNum : undefined, logoAssetId: logo?.id, photoAssetId: photo?.id }),
    [size, design, message, agent, to, propertyAddress, acreNum, logo, photo]);
  const merged = applyMerge(message, { ownerName: to.name, propertyAddress, acreage: acreNum });
  const max = messageMax(size);

  // design thumbnails: the real templates with sample data
  const thumbs = useMemo(() => DESIGNS.map((d) => ({ d, r: renderPostcard({ size, design: d.id, message: 'Sample message.', agent: { name: 'Alex Agent', phone10: '5555550123', brokerage: 'Brokerage' }, merge: SAMPLE }) })), [size]);

  const upload = async (kind: 'logo' | 'photo', file: File | undefined) => {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append('kind', kind); fd.append('file', file);
    const r = await fetch('/api/postcards/assets', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setPreview(null);
    if (r.ok) (kind === 'logo' ? setLogo : setPhoto)({ id: j.id, name: file.name, warnings: j.warnings || [] });
    else setMsg({ ok: false, text: j.message || 'Could not upload that image.' });
  };

  const doPreview = useCallback(async () => {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/postcards/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setPreview(j); else { setPreview(null); setMsg({ ok: false, text: j.message || 'Could not build the preview.' }); }
  }, [body]);

  const send = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `Postcard sent (First Class). ${usd(j.chargedCents)} charged.` }); setPreview(null); setTo({ name: '', line1: '', line2: '', city: '', state: '', zip: '' }); setPropertyAddress(''); setAcreage(''); }
    else setMsg({ ok: false, text: j.message || 'The postcard could not be sent.' });
  };

  if (!wallet) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  if (!wallet.enabled) return <div className="max-w-xl mx-auto p-8 text-slate-300">Postcards are not available yet.</div>;
  const input = 'w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm';
  const price = (s: PostcardSize) => wallet.prices?.[`postcard_${s}`];
  const mergeBtn = (f: string) => <button key={f} type="button" className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-2 py-1" onClick={() => setMessage((m) => `${m} {{${f}}}`)}>{`{{${f}}}`}</button>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Send a postcard</h1>
        <Link href="/wallet" className="text-sm text-blue-400 hover:underline">Wallet: {usd(wallet.balanceCents)}</Link>
      </div>
      {msg && <div className={`text-sm rounded px-3 py-2 border ${msg.ok ? 'bg-emerald-900/30 border-emerald-700' : 'bg-amber-900/30 border-amber-700'}`}>{msg.text}</div>}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">1. Size</h2>
        <div className="flex gap-2 flex-wrap">
          {SIZES.map((s) => { const p = price(s); const off = !p || !p.enabled; return (
            <button key={s} disabled={off} onClick={() => { setSize(s); setPreview(null); }} className={`px-4 py-2 rounded border text-sm ${size === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-700'} disabled:opacity-40`}>
              {s.replace('x', '×')} {p ? <span className="opacity-80">{usd(p.cents)}{s === '4x6' ? ' (default)' : ''}</span> : null}
            </button>); })}
        </div>
        <p className="text-xs text-slate-400">All sizes go First Class. The card is mailed about as fast as a letter.</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">2. Design</h2>
        <div className="grid grid-cols-3 gap-3">
          {thumbs.map(({ d, r }) => (
            <button key={d.id} onClick={() => { setDesign(d.id); setPreview(null); }} className={`text-left rounded-lg border p-2 ${design === d.id ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-950'}`}>
              <Side html={r.front} w={r.widthIn} h={r.heightIn} width={200} />
              <div className="text-sm font-medium mt-2">{d.name}</div><div className="text-xs text-slate-400">{d.blurb}</div>
            </button>))}
        </div>
        <p className="text-xs text-slate-400">Artwork is placeholder for now. Add your own photo below to replace it.</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">3. Your details (required)</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={input} placeholder="Agent name *" value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} />
          <input className={input} placeholder="Phone *" inputMode="tel" value={agent.phone} onChange={(e) => setAgent({ ...agent, phone: e.target.value })} />
          <input className={input} placeholder="Brokerage name *" value={agent.brokerage} onChange={(e) => setAgent({ ...agent, brokerage: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><button className="bg-slate-700 hover:bg-slate-600 rounded px-3 py-1.5" onClick={() => logoRef.current?.click()}>{logo ? 'Replace logo' : 'Upload logo'}</button> <span className="text-slate-400">{logo?.name}</span></span>
          <span><button className="bg-slate-700 hover:bg-slate-600 rounded px-3 py-1.5" onClick={() => photoRef.current?.click()}>{photo ? 'Replace photo' : 'Upload photo'}</button> <span className="text-slate-400">{photo?.name}</span></span>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { upload('logo', e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={photoRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { upload('photo', e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {[...(logo?.warnings ?? []), ...(photo?.warnings ?? [])].map((w) => <p key={w} className="text-xs text-amber-400">{w}</p>)}
        <p className="text-xs text-slate-400">PNG or JPG, under 4 MB. Your details are remembered in this browser.</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">4. Who it is for</h2>
        <input className={input} placeholder="Owner name *" value={to.name} onChange={(e) => setTo({ ...to, name: e.target.value })} />
        <input className={input} placeholder="Owner mailing address *" value={to.line1} onChange={(e) => setTo({ ...to, line1: e.target.value })} />
        <input className={input} placeholder="Apt / suite (optional)" value={to.line2} onChange={(e) => setTo({ ...to, line2: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <input className={input} placeholder="City" value={to.city} onChange={(e) => setTo({ ...to, city: e.target.value })} />
          <input className={input} placeholder="State" maxLength={2} value={to.state} onChange={(e) => setTo({ ...to, state: e.target.value })} />
          <input className={input} placeholder="ZIP" value={to.zip} onChange={(e) => setTo({ ...to, zip: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className={input + ' sm:col-span-2'} maxLength={80} placeholder="Property address (shown on the card)" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
          <input className={input} inputMode="decimal" placeholder="Acreage" value={acreage} onChange={(e) => setAcreage(e.target.value)} />
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">5. Message on the back</h2>
        <textarea className={input + ' min-h-[120px]'} value={message} onChange={(e) => { setMessage(e.target.value); setPreview(null); }} />
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">Insert:</span>{MERGE_FIELDS.map(mergeBtn)}
          <span className={`ml-auto text-xs ${merged.text.length > max ? 'text-amber-400' : 'text-slate-400'}`}>{merged.text.length} / {max} characters on the card</span></div>
        {(merged.missing.length > 0 || merged.unknown.length > 0) && <p className="text-xs text-amber-400">{merged.unknown.length ? `Unknown merge field {{${merged.unknown[0]}}}.` : `{{${merged.missing[0]}}} is used in the message but that field is empty.`}</p>}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">6. Preview and send</h2>
        <button disabled={busy} onClick={doPreview} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">{busy ? 'Working...' : 'Preview my postcard'}</button>
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <div><div className="text-xs text-slate-400 mb-1">Front</div><Side html={preview.front} w={preview.widthIn} h={preview.heightIn} width={Math.min(420, SIZE_SPECS[size].w * 60)} /></div>
              <div><div className="text-xs text-slate-400 mb-1">Back (the address goes in the empty box)</div><Side html={preview.back} w={preview.widthIn} h={preview.heightIn} width={Math.min(420, SIZE_SPECS[size].w * 60)} /></div>
            </div>
            <p className="text-sm">{preview.available ? <>Price: <b>{usd(preview.priceCents)}</b>, charged only after the card is accepted for mailing. Your balance: {usd(preview.balanceCents)}.</> : 'This size is not available right now.'}</p>
            {preview.available && !preview.canAfford && <p className="text-sm text-amber-400">Not enough balance. <Link href="/wallet" className="underline">Add funds</Link>.</p>}
            <button disabled={busy || !preview.canAfford} onClick={send} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">Check address and send for {preview.priceCents != null ? usd(preview.priceCents) : ''}</button>
            <p className="text-xs text-slate-400">The address is checked first. If it fails, nothing is sent and you are not charged.</p>
          </div>
        )}
      </section>
    </div>
  );
}
