import { NextResponse } from 'next/server';
import { SYSTEM_PROMPT, fallbackAnswer } from '@/lib/chat-knowledge';

export const runtime = 'nodejs';

// Public endpoint (listed in proxy.ts). Best-effort per-IP limiter: in-memory, per server instance.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (limited(ip)) return NextResponse.json({ response: 'You are sending messages quickly. Please wait a moment and try again.' }, { status: 429 });

  let body: { message?: unknown; history?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const history: Turn[] = Array.isArray(body.history)
    ? (body.history as Turn[])
        .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
        .slice(-6)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 500) }))
    : [];

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ response: fallbackAnswer(message) });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL || 'claude-haiku-5-5',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [...history, { role: 'user', content: message }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text = Array.isArray(data.content) ? data.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim() : '';
    return NextResponse.json({ response: text || fallbackAnswer(message) });
  } catch (e) {
    console.error('[chat] model call failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ response: fallbackAnswer(message) });
  }
}
