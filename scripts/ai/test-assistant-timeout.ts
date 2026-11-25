// The assistant loop's time budget, with a FAKE model client (no API calls, no cost, no database): a slow model is cut off with a plain message,
// a hung tool is reported as a timeout and the loop carries on, running out of soft time forces a final answer, a normal run is unchanged.
//   npx tsx scripts/ai/test-assistant-timeout.ts
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);
import { runAssistant, TIMEOUT_MESSAGE, type AssistantEvent } from '../../lib/ai/run';

const results: string[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);

type Reply = { stop: 'end_turn' | 'tool_use'; text?: string; tool?: { id: string; name: string; input: any }; delayMs?: number; neverEnds?: boolean };

/** A stand-in for the Anthropic client: replays scripted replies, honours the abort signal like the real SDK, records each request's params. */
function fakeClient(script: Reply[]) {
  const calls: any[] = [];
  let n = 0;
  const client: any = {
    beta: {
      messages: {
        stream(params: any, opts: { signal?: AbortSignal }) {
          calls.push(params);
          const r = script[Math.min(n++, script.length - 1)];
          const handlers: Record<string, (d: string) => void> = {};
          return {
            on(ev: string, fn: (d: string) => void) { handlers[ev] = fn; },
            finalMessage: () => new Promise((resolve, reject) => {
              const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'APIUserAbortError' }));
              if (opts.signal?.aborted) return onAbort();
              opts.signal?.addEventListener('abort', onAbort);
              if (r.text) handlers.text?.(r.text);
              if (r.neverEnds) return; // a model call that never finishes
              setTimeout(() => {
                opts.signal?.removeEventListener('abort', onAbort);
                const content: any[] = [];
                if (r.text) content.push({ type: 'text', text: r.text });
                if (r.tool) content.push({ type: 'tool_use', id: r.tool.id, name: r.tool.name, input: r.tool.input });
                resolve({ content, stop_reason: r.stop, usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
              }, r.delayMs ?? 5);
            }),
          };
        },
      },
    },
  };
  return { client, calls };
}

const ok = (summary = '3 parcels') => async () => ({ ok: true, content: JSON.stringify({ rows: [] }), keys: ['FL-1'], summary });
const base = { userId: 'u', messages: [{ role: 'user' as const, content: 'q' }], model: 'claude-sonnet-5-5' };
const collect = () => { const ev: AssistantEvent[] = []; return { ev, emit: (e: AssistantEvent) => ev.push(e) }; };

(async () => {
  // 1. normal two-step run is unchanged: tool call, then an answer
  {
    const { client, calls } = fakeClient([{ stop: 'tool_use', tool: { id: 't1', name: 'search_parcels', input: {} } }, { stop: 'end_turn', text: 'Here you go.' }]);
    const { ev, emit } = collect();
    const t0 = Date.now();
    const totals = await runAssistant({ ...base, client, runTool: ok() as any }, emit);
    check('normal run: tool result then answer, ends with done/end_turn', ev.some((e) => e.type === 'tool_result' && e.ok) && ev.some((e) => e.type === 'text') && ev[ev.length - 1].type === 'done' && (ev[ev.length - 1] as any).stop_reason === 'end_turn', `${Date.now() - t0} ms`);
    check('normal run: two model calls counted', totals.requests === 2, String(totals.requests));
    check('defaults are fast: effort low, max_tokens 6000', calls[0].output_config.effort === 'low' && calls[0].max_tokens === 6000, `${calls[0].output_config.effort} ${calls[0].max_tokens}`);
    check('normal run: no error event', !ev.some((e) => e.type === 'error'), '');
  }
  // 2. a model call that never finishes is cut off at the deadline, with the friendly message, quickly
  {
    const { client } = fakeClient([{ stop: 'end_turn', text: 'Partial answer so far', neverEnds: true }]);
    const { ev, emit } = collect();
    const t0 = Date.now();
    await runAssistant({ ...base, client, runTool: ok() as any, deadlineMs: 300 }, emit);
    const dt = Date.now() - t0;
    const err = ev.find((e) => e.type === 'error') as any;
    check('hung model: stops at the deadline (not hanging)', dt >= 250 && dt < 2000, `${dt} ms`);
    check('hung model: friendly error message', err?.message === TIMEOUT_MESSAGE, String(err?.message).slice(0, 60));
    check('hung model: text already streamed is kept, and the run still ends with done/timeout', ev.some((e) => e.type === 'text') && (ev[ev.length - 1] as any).type === 'done' && (ev[ev.length - 1] as any).stop_reason === 'timeout', '');
  }
  // 3. a hung tool is reported as a timeout, and the loop goes on to answer
  {
    const { client } = fakeClient([{ stop: 'tool_use', tool: { id: 't1', name: 'search_parcels', input: {} } }, { stop: 'end_turn', text: 'I could not finish the lookup.' }]);
    const { ev, emit } = collect();
    const t0 = Date.now();
    await runAssistant({ ...base, client, runTool: (() => new Promise(() => { /* never returns */ })) as any, toolTimeoutMs: 200 }, emit);
    const tr = ev.find((e) => e.type === 'tool_result') as any;
    check('hung tool: reported as failed (timed out), run continues to an answer', tr && tr.ok === false && /timed out/.test(tr.summary) && ev.some((e) => e.type === 'text') && !ev.some((e) => e.type === 'error'), `${Date.now() - t0} ms`);
  }
  // 4. out of soft time: the next model call is forced to be the final answer (tools disabled)
  {
    const { client, calls } = fakeClient([
      { stop: 'tool_use', tool: { id: 't1', name: 'search_parcels', input: {} }, delayMs: 150 },
      { stop: 'tool_use', tool: { id: 't2', name: 'search_parcels', input: {} } },
      { stop: 'end_turn', text: 'Final.' },
    ]);
    const { ev, emit } = collect();
    await runAssistant({ ...base, client, runTool: ok() as any, softMs: 50 }, emit);
    check('soft limit: second call already has tools disabled (must answer)', calls.length >= 2 && calls[1].tool_choice.type === 'none', JSON.stringify(calls.map((c) => c.tool_choice.type)));
    check('soft limit: first call still allows tools', calls[0].tool_choice.type === 'auto', calls[0].tool_choice.type);
    check('soft limit: run finishes cleanly', ev[ev.length - 1].type === 'done', '');
  }
  // 5. the user closing the chat (client abort) ends the run without an error message to show
  {
    const { client } = fakeClient([{ stop: 'end_turn', text: 'x', neverEnds: true }]);
    const ctl = new AbortController();
    const { ev, emit } = collect();
    setTimeout(() => ctl.abort(), 100);
    let threw = false;
    try { await runAssistant({ ...base, client, runTool: ok() as any, signal: ctl.signal }, emit); } catch { threw = true; }
    check('client abort: ends promptly (thrown to the route, which stays quiet)', threw === true && !ev.some((e) => e.type === 'error'), `threw=${threw}`);
  }

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
