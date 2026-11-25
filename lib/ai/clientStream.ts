// Reads the assistant's streamed answer (one JSON event per line) in the browser. Pulled out of the chat window so it can be tested without a browser.
//   - calls onEvent for every event, in order;
//   - remembers whether the server's final event ("done" or "error") arrived: if the stream ends without it, the server was cut off;
//   - if nothing arrives for stallMs, calls abort() (the caller cancels the request) and reports stalled.
import type { AssistantEvent } from '@/lib/ai/run';

export interface StreamReader { read(): Promise<{ value?: Uint8Array; done: boolean }> }
export interface StreamResult { finished: boolean; stalled: boolean }

export const STALL_MS = 100_000;

export async function readAssistantStream(
  reader: StreamReader,
  onEvent: (e: AssistantEvent | { type: 'cost'; usd: number | null }) => void,
  opts: { stallMs?: number; abort: () => void },
): Promise<StreamResult> {
  const dec = new TextDecoder();
  let buf = '';
  let finished = false;
  let stalled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { stalled = true; opts.abort(); }, opts.stallMs ?? STALL_MS); };
  arm();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      arm();
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: any;
        try { ev = JSON.parse(line); } catch { continue; } // a damaged line is skipped, never fatal
        if (ev?.type === 'done' || ev?.type === 'error') finished = true;
        onEvent(ev);
      }
    }
  } catch (e: any) {
    // Our own stall abort ends the read with an error: that is a normal "stalled" result. Anything else (the user closing the chat) is the caller's business.
    if (!stalled) throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return { finished, stalled };
}
