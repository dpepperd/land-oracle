// The chat window's stream reader (lib/ai/clientStream.ts): events arrive in order, a stream that ends without the server's final event is flagged,
// a stream that goes quiet is aborted and flagged, damaged lines are skipped. No browser, no network, no cost.
//   npx tsx scripts/ai/test-assistant-stream.ts
import { readAssistantStream, type StreamReader } from '../../lib/ai/clientStream';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
const enc = new TextEncoder();

/** A fake reader that replays chunks with delays; `hang` makes the last read wait until abort() is called. */
function fakeReader(chunks: string[], opts: { delayMs?: number; hang?: boolean } = {}) {
  let i = 0;
  let rejectHang: ((e: Error) => void) | null = null;
  const reader: StreamReader = {
    read: () => {
      if (i < chunks.length) { const c = chunks[i++]; return new Promise((res) => setTimeout(() => res({ value: enc.encode(c), done: false }), opts.delayMs ?? 1)); }
      if (opts.hang) return new Promise((_, rej) => { rejectHang = rej; });
      return Promise.resolve({ done: true });
    },
  };
  return { reader, abort: () => rejectHang?.(Object.assign(new Error('aborted'), { name: 'AbortError' })) };
}
const line = (o: any) => JSON.stringify(o) + '\n';

(async () => {
  // 1. normal stream, events in order, finished
  {
    const { reader, abort } = fakeReader([line({ type: 'text', delta: 'Hello ' }) + line({ type: 'text', delta: 'world' }), line({ type: 'done', stop_reason: 'end_turn' })]);
    const seen: string[] = [];
    const r = await readAssistantStream(reader, (e: any) => seen.push(e.type === 'text' ? e.delta : e.type), { abort });
    check('normal stream: events in order', JSON.stringify(seen) === JSON.stringify(['Hello ', 'world', 'done']), JSON.stringify(seen));
    check('normal stream: finished, not stalled', r.finished === true && r.stalled === false, JSON.stringify(r));
  }
  // 2. an event split across two chunks is reassembled
  {
    const full = line({ type: 'text', delta: 'split across chunks' }) + line({ type: 'done', stop_reason: 'end_turn' });
    const { reader, abort } = fakeReader([full.slice(0, 17), full.slice(17)]);
    const seen: string[] = [];
    const r = await readAssistantStream(reader, (e: any) => seen.push(e.type === 'text' ? e.delta : e.type), { abort });
    check('split chunk is reassembled into one event', seen[0] === 'split across chunks' && r.finished, JSON.stringify(seen));
  }
  // 3. the stream ends with no final event (the server was cut off): not finished
  {
    const { reader, abort } = fakeReader([line({ type: 'text', delta: 'Partial answer' })]);
    const seen: string[] = [];
    const r = await readAssistantStream(reader, (e: any) => seen.push(e.type), { abort });
    check('cut-off stream (no done/error): finished=false so the screen can say so', r.finished === false && r.stalled === false && seen.length === 1, JSON.stringify(r));
  }
  // 4. an error event counts as the final event
  {
    const { reader, abort } = fakeReader([line({ type: 'error', message: 'The assistant is busy.' })]);
    const r = await readAssistantStream(reader, () => {}, { abort });
    check('error event counts as finished', r.finished === true, JSON.stringify(r));
  }
  // 5. a stream that goes quiet is aborted after stallMs and reported as stalled (and quickly)
  {
    const { reader, abort } = fakeReader([line({ type: 'text', delta: 'Working on it' })], { hang: true });
    let aborted = false;
    const t0 = Date.now();
    const r = await readAssistantStream(reader, () => {}, { stallMs: 250, abort: () => { aborted = true; abort(); } });
    const dt = Date.now() - t0;
    check('quiet stream: abort called, reported stalled, not finished', aborted && r.stalled === true && r.finished === false, JSON.stringify(r));
    check('quiet stream: gave up after about stallMs, did not hang', dt >= 200 && dt < 2000, `${dt} ms`);
  }
  // 6. activity keeps resetting the stall timer (slow but alive is fine)
  {
    const chunks = [0, 1, 2, 3].map((n) => line({ type: 'text', delta: String(n) })).concat([line({ type: 'done', stop_reason: 'end_turn' })]);
    const { reader, abort } = fakeReader(chunks, { delayMs: 120 });
    const r = await readAssistantStream(reader, () => {}, { stallMs: 300, abort });
    check('slow but steady stream is not treated as stalled (total 600 ms, stallMs 300)', r.finished === true && r.stalled === false, JSON.stringify(r));
  }
  // 7. a damaged line is skipped; the rest still arrives
  {
    const { reader, abort } = fakeReader(['this is not json\n' + line({ type: 'text', delta: 'ok' }) + line({ type: 'done', stop_reason: 'end_turn' })]);
    const seen: string[] = [];
    const r = await readAssistantStream(reader, (e: any) => seen.push(e.type), { abort });
    check('damaged line is skipped, later events still delivered', JSON.stringify(seen) === JSON.stringify(['text', 'done']) && r.finished, JSON.stringify(seen));
  }
  // 8. an error that is not our own stall abort (for example the user closing the chat) is passed to the caller
  {
    const reader: StreamReader = { read: () => Promise.reject(Object.assign(new Error('user closed'), { name: 'AbortError' })) };
    let threw = false;
    try { await readAssistantStream(reader, () => {}, { stallMs: 5000, abort: () => {} }); } catch { threw = true; }
    check('user abort / network error is rethrown to the caller (not reported as stalled)', threw, '');
  }

  console.log(results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('FAIL')).length} FAIL of ${results.length}`);
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
