// The assistant's tool-use loop (manual loop, streaming, max 6 model calls). Framework-free so the route and the test harness share it.
//
// Time budget (the route is killed by the platform at 120 s, which used to leave the chat window hanging):
//   - soft limit (default 60 s): stop calling tools, make the next model call the final one (tools disabled, it must answer);
//   - hard limit (default 95 s): abort the model call and tell the user plainly, keeping any text already streamed;
//   - each tool call is capped (default 25 s) and reports a timeout to the model instead of hanging the loop.
import Anthropic from '@anthropic-ai/sdk';
import { systemPrompt } from './prompt';
import { executeTool, toolDefinitions } from './tools';
import { emptyTotals, type Totals } from './pricing';

export const MAX_ITERATIONS = 6;
export const DEFAULT_SOFT_MS = 60_000;
export const DEFAULT_DEADLINE_MS = 95_000;
export const DEFAULT_TOOL_TIMEOUT_MS = 25_000;
/** Typical answers are a short table plus a few bullets; a smaller cap keeps generation fast. Raise with env ANTHROPIC_MAX_TOKENS. */
export const DEFAULT_MAX_TOKENS = 6_000;
export const TIMEOUT_MESSAGE = 'That question took longer than expected, so I stopped. Try a narrower question (one county, a tighter acreage or value range) and ask again.';

export type AssistantEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; summary: string; keys: string[] }
  | { type: 'notice'; message: string }
  | { type: 'usage'; totals: Totals; iterations: number }
  | { type: 'done'; stop_reason: string | null }
  | { type: 'error'; message: string };

export interface RunOptions {
  client: Anthropic;
  userId: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  model: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
  signal?: AbortSignal;
  /** Shared accumulator so usage survives a mid-run failure. */
  totals?: Totals;
  softMs?: number;
  deadlineMs?: number;
  toolTimeoutMs?: number;
  /** Test hook: replaces executeTool. */
  runTool?: typeof executeTool;
}

const FALLBACK_MODELS = /^(claude-(fable-5|opus-5|sonnet-5-5))/;

type ToolOut = Awaited<ReturnType<typeof executeTool>>;

/** Runs a tool but never waits longer than `ms` (or past an abort). A timeout is reported to the model as a failed lookup. */
async function runToolWithTimeout(run: typeof executeTool, name: string, input: unknown, userId: string, ms: number, abort: AbortSignal): Promise<ToolOut> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timedOut = new Promise<ToolOut>((resolve) => {
    const fail = () => resolve({
      ok: false,
      content: JSON.stringify({ error: 'TOOL_TIMEOUT', message: 'The data lookup took too long. Narrow the request (one county, tighter filters) or answer with what you have.' }),
      keys: [],
      summary: 'lookup timed out',
    });
    timer = setTimeout(fail, ms);
    onAbort = fail;
    abort.addEventListener('abort', onAbort);
  });
  try { return await Promise.race([run(name, input, userId), timedOut]); }
  finally { if (timer) clearTimeout(timer); if (onAbort) abort.removeEventListener('abort', onAbort); }
}

export async function runAssistant(opts: RunOptions, emit: (e: AssistantEvent) => void): Promise<Totals> {
  const { client, userId, model } = opts;
  const totals = opts.totals ?? emptyTotals();
  const tools = toolDefinitions();
  const system = [{ type: 'text' as const, text: systemPrompt(), cache_control: { type: 'ephemeral' as const } }];
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const useFallback = process.env.ANTHROPIC_FALLBACKS === 'on' && FALLBACK_MODELS.test(model);
  let lastStop: string | null = null;

  const started = Date.now();
  const softMs = opts.softMs ?? DEFAULT_SOFT_MS;
  const toolMs = opts.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  const runTool = opts.runTool ?? executeTool;
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ac.abort(); }, opts.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const onClientGone = () => ac.abort();
  if (opts.signal) { if (opts.signal.aborted) ac.abort(); else opts.signal.addEventListener('abort', onClientGone); }

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Out of soft time: this call must be the final answer (tools stay declared because the history holds tool blocks, but cannot be used).
      const lastCall = i === MAX_ITERATIONS - 1 || (i > 0 && Date.now() - started > softMs);
      const params: any = {
        model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        tools,
        messages,
        output_config: { effort: opts.effort ?? 'low' },
        tool_choice: lastCall ? { type: 'none' } : { type: 'auto' },
      };
      if (useFallback) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }

      const stream = client.beta.messages.stream(params, { signal: ac.signal });
      stream.on('text', (delta: string) => emit({ type: 'text', delta }));
      const msg = await stream.finalMessage();

      totals.requests += 1;
      totals.input += msg.usage.input_tokens ?? 0;
      totals.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;
      totals.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
      totals.output += msg.usage.output_tokens ?? 0;
      lastStop = msg.stop_reason;
      emit({ type: 'usage', totals: { ...totals }, iterations: i + 1 });

      if (msg.stop_reason === 'refusal') { emit({ type: 'error', message: 'The assistant declined to answer this request.' }); break; }
      if (msg.stop_reason === 'max_tokens') emit({ type: 'notice', message: 'The answer was cut off. Ask me to continue.' });
      if (msg.stop_reason !== 'tool_use') break;

      // Preserve the full assistant content (thinking blocks included) and answer every tool_use in ONE user message.
      messages.push({ role: 'assistant', content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      for (const c of calls) emit({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
      const results = await Promise.all(calls.map(async (c) => {
        const out = await runToolWithTimeout(runTool, c.name, c.input, userId, toolMs, ac.signal);
        emit({ type: 'tool_result', id: c.id, name: c.name, ok: out.ok, summary: out.summary, keys: out.keys });
        return { type: 'tool_result' as const, tool_use_id: c.id, content: out.content, ...(out.ok ? {} : { is_error: true }) };
      }));
      messages.push({ role: 'user', content: results });
      if (lastCall) break;
    }
  } catch (e) {
    // Hard limit reached: say so plainly (text already streamed stays on screen). Anything else is for the caller to report.
    if (!timedOut) throw e;
    emit({ type: 'error', message: TIMEOUT_MESSAGE });
    lastStop = 'timeout';
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onClientGone);
  }
  emit({ type: 'done', stop_reason: lastStop });
  return totals;
}
