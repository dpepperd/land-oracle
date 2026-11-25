// OPT-IN timing check for the AI assistant, against the REAL model and the DEV database. COSTS REAL MONEY (a few cents per question: it prints the cost).
// Not part of any test suite: run it by hand when you want to know how long typical questions take.
//   npx tsx scripts/ai/assistant-latency.ts            (3 typical questions, as the first admin account)
//   npx tsx scripts/ai/assistant-latency.ts "my own question here"
// Needs ANTHROPIC_API_KEY in .env.local. Uses the same defaults as the live route (effort low, 6000 max tokens, 60 s soft / 95 s hard limit).
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), quiet: true } as any);

const QUESTIONS = [
  'Find vacant parcels of 10 to 20 acres in Clay County owned by out-of-state owners. Show the 5 largest.',
  'How many absentee-owned parcels over 5 acres are in Baker County? Give a one-line answer.',
  'In Clay County, what is the typical sale price per acre for 5 to 10 acre parcels in the last 2 years?',
];

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.log('No ANTHROPIC_API_KEY in .env.local: nothing to do.'); process.exit(1); }
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const { default: pool } = await import('../../lib/db');
  const { runAssistant } = await import('../../lib/ai/run');
  const { costUsd, emptyTotals } = await import('../../lib/ai/pricing');
  const admin = (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const effort = (['low', 'medium', 'high', 'xhigh', 'max'] as const).find((e) => e === process.env.ANTHROPIC_EFFORT) ?? 'low';
  const maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS) > 0 ? Number(process.env.ANTHROPIC_MAX_TOKENS) : undefined;
  const questions = process.argv[2] ? [process.argv.slice(2).join(' ')] : QUESTIONS;
  console.log(`model=${model} effort=${effort} (this spends real money)\n`);
  let total = 0;
  for (const q of questions) {
    const t0 = Date.now();
    const totals = emptyTotals();
    let tools = 0, answer = '', err = '';
    await runAssistant({ client, userId: admin.clerk_id, messages: [{ role: 'user', content: q }], model, effort, maxTokens, totals }, (e) => {
      if (e.type === 'tool_use') tools += 1;
      else if (e.type === 'text') answer += e.delta;
      else if (e.type === 'error') err = e.message;
    });
    const secs = (Date.now() - t0) / 1000;
    const usd = costUsd(model, totals) ?? 0; total += usd;
    console.log(`${secs.toFixed(1).padStart(5)} s  ${tools} tool calls  out=${totals.output} tokens  $${usd.toFixed(3)}  ${secs <= 20 ? 'OK (<= 20 s)' : 'SLOW (> 20 s)'}${err ? '  ERROR: ' + err : ''}\n      Q: ${q}\n      A: ${answer.replace(/\s+/g, ' ').slice(0, 160)}...\n`);
  }
  console.log(`Total cost about $${total.toFixed(3)}`);
  process.exit(0);
})();
