// The assistant's tool-use loop (manual loop, streaming, max 6 model calls). Framework-free so the route and the test harness share it.
import Anthropic from '@anthropic-ai/sdk';
import { systemPrompt } from './prompt';
import { executeTool, toolDefinitions } from './tools';
import { emptyTotals, type Totals } from './pricing';

export const MAX_ITERATIONS = 6;

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
}

const FALLBACK_MODELS = /^(claude-(fable-5|opus-5|sonnet-5-5))/;

export async function runAssistant(opts: RunOptions, emit: (e: AssistantEvent) => void): Promise<Totals> {
  const { client, userId, model } = opts;
  const totals = opts.totals ?? emptyTotals();
  const tools = toolDefinitions();
  const system = [{ type: 'text' as const, text: systemPrompt(), cache_control: { type: 'ephemeral' as const } }];
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const useFallback = process.env.ANTHROPIC_FALLBACKS === 'on' && FALLBACK_MODELS.test(model);
  let lastStop: string | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const lastCall = i === MAX_ITERATIONS - 1;
    const params: any = {
      model,
      max_tokens: opts.maxTokens ?? 16_000,
      system,
      tools,
      messages,
      output_config: { effort: opts.effort ?? 'medium' },
      // On the final allowed call tools stay declared (history contains tool blocks) but cannot be used: the model must answer.
      tool_choice: lastCall ? { type: 'none' } : { type: 'auto' },
    };
    if (useFallback) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }

    const stream = client.beta.messages.stream(params, { signal: opts.signal });
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
      const out = await executeTool(c.name, c.input, userId);
      emit({ type: 'tool_result', id: c.id, name: c.name, ok: out.ok, summary: out.summary, keys: out.keys });
      return { type: 'tool_result' as const, tool_use_id: c.id, content: out.content, ...(out.ok ? {} : { is_error: true }) };
    }));
    messages.push({ role: 'user', content: results });
    if (lastCall) break;
  }
  emit({ type: 'done', stop_reason: lastStop });
  return totals;
}
