// Monthly AI assistant usage + plan limits. Table: ai_usage (db/migrations/009), keyed by Clerk user id.
// The limit is counted in QUESTIONS (one user message = one question, however many tool calls it takes).
// Admins are exempt (the caller checks Access.isAdmin). Free and Scout plans do not include the assistant.
import pool from '@/lib/db';
import type { Tier } from '@/lib/entitlements';
import type { Totals } from './pricing';

const DEFAULT_QUESTIONS: Record<Tier, number> = { free: 0, scout: 0, pro: 150, statewide: 500, enterprise: 500 };

/** Questions allowed per month for a plan. Override with env AI_CAP_PRO / AI_CAP_STATEWIDE (a number; 0 disables). */
export function capFor(tier: Tier): number {
  const raw = process.env[`AI_CAP_${tier.toUpperCase()}`];
  if (raw !== undefined && raw !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return DEFAULT_QUESTIONS[tier];
}

export const planIncludesAssistant = (tier: Tier) => capFor(tier) > 0;

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); };
export const nextReset = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); };

export async function getUsage(userId: string): Promise<{ input: number; output: number; requests: number }> {
  const r = await pool.query('SELECT input_tokens, output_tokens, requests FROM ai_usage WHERE user_id = $1 AND month = $2', [userId, monthStart()]);
  const x = r.rows[0];
  return { input: Number(x?.input_tokens ?? 0), output: Number(x?.output_tokens ?? 0), requests: Number(x?.requests ?? 0) };
}

export async function checkCap(userId: string, tier: Tier): Promise<{ allowed: boolean; used: number; cap: number; resetsAt: string }> {
  const u = await getUsage(userId);
  const cap = capFor(tier);
  return { allowed: u.requests < cap, used: u.requests, cap, resetsAt: nextReset().toISOString() };
}

export async function recordUsage(userId: string, t: Totals): Promise<void> {
  await pool.query(
    `INSERT INTO ai_usage (user_id, month, input_tokens, output_tokens, requests) VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (user_id, month) DO UPDATE SET input_tokens = ai_usage.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens, requests = ai_usage.requests + 1, updated_at = now()`,
    [userId, monthStart(), t.input + t.cacheWrite + t.cacheRead, t.output],
  );
}
