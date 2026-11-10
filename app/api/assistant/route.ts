// In-portal AI analysis assistant (separate from the public site chatbot at /api/chat). Node runtime (not edge): uses pg + @anthropic-ai/sdk. Streams NDJSON events (see lib/ai/run.ts).
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { runAssistant, type AssistantEvent } from '@/lib/ai/run';
import { costUsd, emptyTotals } from '@/lib/ai/pricing';
import { checkCap, planIncludesAssistant, recordUsage } from '@/lib/ai/usage';
import { AccessError, resolveAccess } from '@/lib/parcels/access';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(6000) })).min(1).max(30),
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Lets the UI decide whether to show the assistant: { enabled, reason?, used?, cap? }. Never throws on a normal denial. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });
  if (!process.env.ANTHROPIC_API_KEY) return json(200, { enabled: false, reason: 'not_configured' });
  let access;
  try { access = await resolveAccess(userId); } catch { return json(200, { enabled: false, reason: 'no_account' }); }
  if (access.isAdmin) return json(200, { enabled: true, admin: true });
  if (process.env.AI_ASSISTANT_ENABLED !== 'true') return json(200, { enabled: false, reason: 'coming_soon' });
  if (!planIncludesAssistant(access.tier)) return json(200, { enabled: false, reason: 'plan_required' });
  const cap = await checkCap(userId, access.tier);
  return json(200, { enabled: true, used: cap.used, cap: cap.cap });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: 'Unauthorized' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  if (!apiKey) return json(503, { error: 'ai_not_configured', message: 'The AI assistant is not available right now.' });

  let body;
  try { body = bodySchema.parse(await req.json()); } catch { return json(400, { error: 'Invalid request' }); }
  if (body.messages[body.messages.length - 1].role !== 'user') return json(400, { error: 'Last message must be from the user' });

  let access;
  try { access = await resolveAccess(userId); } catch (e) {
    if (e instanceof AccessError) return json(403, { error: 'forbidden', message: e.message });
    throw e;
  }

  // Launch switch + plan gate (admins always allowed, so the owner can test before launch)
  if (!access.isAdmin) {
    if (process.env.AI_ASSISTANT_ENABLED !== 'true') return json(403, { error: 'coming_soon', message: 'The AI assistant is coming soon.' });
    if (!planIncludesAssistant(access.tier)) {
      return json(403, { error: 'plan_required', message: 'The AI assistant is included with the Pro and Statewide plans. You can upgrade from the Pricing page.' });
    }
    const cap = await checkCap(userId, access.tier);
    if (!cap.allowed) {
      return json(429, {
        error: 'ai_cap_reached',
        message: `You've used all ${cap.cap} AI questions included with your ${access.tier} plan this month. It resets on ${new Date(cap.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}, or you can upgrade your plan for more.`,
        used: cap.used, cap: cap.cap, resetsAt: cap.resetsAt,
      });
    }
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const effort = (['low', 'medium', 'high', 'xhigh', 'max'] as const).find((e) => e === process.env.ANTHROPIC_EFFORT) ?? 'medium';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AssistantEvent | { type: 'cost'; usd: number | null }) => { try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')); } catch { /* client went away */ } };
      const totals = emptyTotals();
      try {
        await runAssistant({ client, userId, messages: body.messages, model, effort, signal: req.signal, totals }, send);
      } catch (e: any) {
        console.error('[assistant] failure', e?.status, e?.message);
        const msg = e instanceof Anthropic.RateLimitError ? 'The assistant is busy. Please try again in a moment.'
          : e instanceof Anthropic.APIError ? 'The assistant hit an error. Please try again.' : 'Something went wrong. Please try again.';
        send({ type: 'error', message: msg });
      }
      // Record whatever was consumed, even if the request failed part-way.
      if (totals.requests > 0 && !access.isAdmin) {
        try { await recordUsage(userId, totals); } catch (e: any) { console.error('[assistant] usage record failed', e?.message); }
      }
      const usd = costUsd(model, totals);
      console.log(`[assistant] model=${model} requests=${totals.requests} in=${totals.input} cacheW=${totals.cacheWrite} cacheR=${totals.cacheRead} out=${totals.output} usd=${usd === null ? 'n/a' : usd.toFixed(4)} tier=${access.tier} admin=${access.isAdmin}`);
      if (access.isAdmin) send({ type: 'cost', usd });
      try { controller.close(); } catch { /* already closed */ }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
