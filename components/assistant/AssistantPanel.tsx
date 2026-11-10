'use client';

// In-portal AI analysis assistant (Claude via /api/assistant). Streams NDJSON events; shows parcel citations as chips.
// Shown only when GET /api/assistant says enabled (admins now; Pro/Statewide once AI_ASSISTANT_ENABLED=true).
// Events in: window 'landoracle:open-assistant' { prefill?: string }
import { Fragment, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { X, Send, Bot, User, Loader2, Search, MapPin, Sparkles } from 'lucide-react';

interface ToolChip { id: string; name: string; done: boolean; ok?: boolean; summary?: string }
interface Msg { id: string; role: 'user' | 'assistant'; text: string; tools?: ToolChip[]; error?: boolean; cost?: number | null }

const TOOL_LABEL: Record<string, string> = {
  search_parcels: 'Searching parcels', get_parcel: 'Reading parcel', get_comps: 'Finding comparable sales', get_parcel_context: 'Checking flood and highways',
};

/** Hand parcels to the dashboard (list + map). If the user is elsewhere, open the dashboard and pass them via sessionStorage. */
function showOnDashboard(keys: string[], pathname: string, push: (url: string) => void, select?: string) {
  const uniq = [...new Set(keys)].slice(0, 50);
  if (!uniq.length) return;
  if (!pathname.startsWith('/dashboard')) {
    try { sessionStorage.setItem('lo:ai-parcels', JSON.stringify({ keys: uniq, select })); } catch { /* ignore */ }
    push('/dashboard');
    return;
  }
  window.dispatchEvent(new CustomEvent('landoracle:show-parcels', { detail: { keys: uniq, select } }));
}

function Inline({ text, known, onShow }: { text: string; known: Set<string>; onShow: (k: string) => void }) {
  // [label](parcel:KEY) | [label](https://...) | **bold** | `code` | bare parcel_key seen in tool results
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((parcel:[^)\s]+|https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\b([A-Z]{2}-\d{2,3}-[A-Z0-9][A-Z0-9\-+*()_<>]*[A-Z0-9])\b/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m![1] && m![2]?.startsWith('parcel:')) {
      const key = decodeURIComponent(m[2].slice(7));
      out.push(<button key={i++} onClick={() => onShow(key)} className="inline-flex items-center gap-0.5 text-blue-300 hover:text-blue-200 font-mono text-[12px] bg-blue-950/60 px-1 rounded" title="Show on map"><MapPin size={11} />{m[1]}</button>);
    } else if (m[1] && m[2]) {
      out.push(<a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{m[1]}</a>);
    } else if (m[3]) out.push(<strong key={i++} className="font-semibold text-white">{m[3]}</strong>);
    else if (m[4]) out.push(<code key={i++} className="bg-slate-900 px-1 rounded text-[12px]">{m[4]}</code>);
    else if (m[5]) {
      const bare = m[5];
      if (known.has(bare)) out.push(<button key={i++} onClick={() => onShow(bare)} className="inline-flex items-center gap-0.5 text-blue-300 hover:text-blue-200 font-mono text-[12px] bg-blue-950/60 px-1 rounded" title="Show on map"><MapPin size={11} />{m[5]}</button>);
      else out.push(m[5]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, k) => <Fragment key={k}>{n}</Fragment>)}</>;
}

function Markdown({ text, known, onShow }: { text: string; known: Set<string>; onShow: (k: string) => void }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:\-|]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      i--;
      blocks.push(
        <div key={i} className="overflow-x-auto my-2"><table className="text-[12px] border-collapse">
          <thead><tr>{rows[0]?.map((c, j) => <th key={j} className="border border-slate-700 px-2 py-1 text-left bg-slate-900"><Inline text={c} known={known} onShow={onShow} /></th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j} className="border border-slate-700 px-2 py-1"><Inline text={c} known={known} onShow={onShow} /></td>)}</tr>)}</tbody>
        </table></div>);
    } else if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      i--;
      blocks.push(<ul key={i} className="list-disc pl-5 my-1 space-y-0.5">{items.map((t, j) => <li key={j}><Inline text={t} known={known} onShow={onShow} /></li>)}</ul>);
    } else if (/^\s*\d+\.\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      i--;
      blocks.push(<ol key={i} className="list-decimal pl-5 my-1 space-y-0.5">{items.map((t, j) => <li key={j}><Inline text={t} known={known} onShow={onShow} /></li>)}</ol>);
    } else if (/^#{1,4}\s+/.test(l)) {
      blocks.push(<p key={i} className="font-semibold text-white mt-2"><Inline text={l.replace(/^#{1,4}\s+/, '')} known={known} onShow={onShow} /></p>);
    } else if (l.trim() === '') {
      blocks.push(<div key={i} className="h-1.5" />);
    } else {
      blocks.push(<p key={i}><Inline text={l} known={known} onShow={onShow} /></p>);
    }
  }
  return <div className="space-y-0.5">{blocks}</div>;
}

export default function AssistantPanel() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [enabled, setEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'hello', role: 'assistant', text: "I'm the Land Oracle analyst. Ask about parcels in your counties, for example: absentee-owned vacant land over 5 acres, comparable sales near a parcel, or flood exposure. I only use property facts." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, isOpen]);

  useEffect(() => {
    const open = (e: Event) => {
      const prefill = (e as CustomEvent<{ prefill?: string }>).detail?.prefill;
      setIsOpen(true);
      if (prefill) { setInput(prefill); setTimeout(() => inputRef.current?.focus(), 50); }
    };
    window.addEventListener('landoracle:open-assistant', open);
    return () => window.removeEventListener('landoracle:open-assistant', open);
  }, []);

  const lastKeys = useRef<string[]>([]);
  // Chip click: keep the whole latest result set on the map and highlight the clicked parcel.
  const onShow = (k: string) => showOnDashboard([k, ...lastKeys.current], pathname, router.push, k);

  useEffect(() => {
    if (!isSignedIn) { setEnabled(false); return; }
    fetch('/api/assistant').then((r) => r.json()).then((j) => setEnabled(!!j.enabled)).catch(() => setEnabled(false));
  }, [isSignedIn]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const history = [...messages.filter((m) => m.id !== 'hello' && !m.error), { id: crypto.randomUUID(), role: 'user' as const, text }];
    const aId = crypto.randomUUID();
    setMessages([...messages, history[history.length - 1], { id: aId, role: 'assistant', text: '', tools: [] }]);
    setBusy(true);
    const ac = new AbortController(); abortRef.current = ac;
    const patch = (fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m) => (m.id === aId ? fn(m) : m)));
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ac.signal,
        body: JSON.stringify({ messages: history.slice(-30).map((m) => ({ role: m.role, content: m.text.slice(0, 6000) })) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        patch((m) => ({ ...m, error: true, text: j.message || (res.status === 401 ? 'Please sign in to use the assistant.' : 'The assistant is unavailable right now.') }));
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: any; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'text') patch((m) => ({ ...m, text: m.text + ev.delta }));
          else if (ev.type === 'tool_use') patch((m) => ({ ...m, tools: [...(m.tools ?? []), { id: ev.id, name: ev.name, done: false }] }));
          else if (ev.type === 'tool_result') {
            patch((m) => ({ ...m, tools: (m.tools ?? []).map((t) => (t.id === ev.id ? { ...t, done: true, ok: ev.ok, summary: ev.summary } : t)) }));
            if (ev.keys?.length) setKnown((prev) => new Set([...prev, ...ev.keys]));
            if (ev.ok && ev.keys?.length && (ev.name === 'search_parcels' || ev.name === 'get_comps')) { lastKeys.current = ev.keys; showOnDashboard(ev.keys, pathname, router.push); }
          } else if (ev.type === 'cost') patch((m) => ({ ...m, cost: ev.usd }));
          else if (ev.type === 'notice') patch((m) => ({ ...m, text: m.text + `\n\n_${ev.message}_` }));
          else if (ev.type === 'error') patch((m) => ({ ...m, error: true, text: (m.text ? m.text + '\n\n' : '') + ev.message }));
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') patch((m) => ({ ...m, error: true, text: m.text || 'Connection problem. Please try again.' }));
    } finally { setBusy(false); abortRef.current = null; }
  };

  if (!isSignedIn || !enabled) return null;

  return (
    <>
      <button onClick={() => setIsOpen((o) => !o)} aria-label="Toggle AI analyst"
        className={`fixed bottom-24 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 text-white text-sm font-medium ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
        {isOpen ? <X size={18} /> : <Sparkles size={18} />}
        {isOpen ? 'Close' : 'AI Analyst'}
      </button>
      <div className={`fixed bottom-40 right-6 z-[9998] w-[92vw] sm:w-[440px] h-[600px] max-h-[72vh] transition-all duration-300 origin-bottom-right font-sans ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8 pointer-events-none'}`}>
        <div className="flex flex-col h-full w-full bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg"><Bot className="w-5 h-5 text-blue-400" /></div>
              <div><h3 className="text-white font-semibold text-sm">AI Analyst</h3><p className="text-xs text-slate-400">Parcel research assistant</p></div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-600' : 'bg-slate-800'}`}>
                  {m.role === 'user' ? <User size={14} className="text-white/90" /> : <Bot size={14} className="text-blue-400" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap' : `bg-slate-800 border ${m.error ? 'border-amber-600/60' : 'border-slate-700'} text-slate-200 rounded-tl-sm`}`}>
                  {m.tools?.map((t) => (
                    <div key={t.id} className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                      {t.done ? <Search size={11} className={t.ok ? 'text-green-400' : 'text-amber-400'} /> : <Loader2 size={11} className="animate-spin" />}
                      <span>{TOOL_LABEL[t.name] ?? t.name}{t.done && t.summary ? `: ${t.summary}` : '...'}</span>
                    </div>
                  ))}
                  {m.role === 'assistant' && m.cost !== undefined && m.cost !== null && <div className="text-[10px] text-slate-500 mb-1">Admin: this answer cost about ${m.cost.toFixed(3)} ({m.tools?.length ?? 0} tool calls)</div>}
                  {m.role === 'user' ? m.text : m.text ? <Markdown text={m.text} known={known} onShow={onShow} /> : busy && !m.tools?.length ? <Loader2 size={14} className="animate-spin text-slate-400" /> : null}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="p-3 border-t border-slate-800 bg-slate-900/50">
            <div className="relative">
              <textarea ref={inputRef} rows={2} value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="Ask about parcels, comps, flood..."
                className="w-full resize-none bg-slate-800 border border-slate-700 focus:border-blue-500/50 rounded-xl pl-4 pr-12 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
              <button type="submit" disabled={!input.trim() || busy}
                className="absolute right-2 bottom-2.5 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">AI can make mistakes. Verify property facts with the county before transacting.</p>
          </form>
        </div>
      </div>
    </>
  );
}
