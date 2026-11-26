// What the "You're subscribed" banner shows after checkout. Pure shaping of rows we already have; no Stripe call and no
// price (what was charged depends on coupons: the invoice and receipt are the source for amounts).
import { PLANS, isPlanId, type PlanId } from './plans';

const ENTITLED = new Set(['active', 'trialing', 'past_due']);

export interface BillingSummaryRow {
  subscription_tier: string | null;
  subscription_status: string | null;
  plan_interval: string | null;
  county_allowance: number | null;
  current_period_end: Date | string | null;
  cancel_at_period_end: boolean | null;
  email: string | null;
}

export interface BillingSummary {
  active: boolean;
  plan: { id: PlanId; name: string } | null;
  interval: 'month' | 'year' | null;
  allowance: number | null;          // counties included (null for statewide: all)
  counties: string[] | 'all';        // counties selected so far
  exportsPerMonth: number | 'unlimited' | null;
  aiAnalyst: boolean;
  renewsOn: string | null;           // ISO date
  cancelAtPeriodEnd: boolean;
  email: string | null;
}

export function buildBillingSummary(row: BillingSummaryRow, counties: string[] | 'all'): BillingSummary {
  const tier = row.subscription_tier ?? '';
  const active = isPlanId(tier) && ENTITLED.has(row.subscription_status ?? '');
  if (!active) {
    return { active: false, plan: null, interval: null, allowance: null, counties, exportsPerMonth: null, aiAnalyst: false, renewsOn: null, cancelAtPeriodEnd: false, email: row.email };
  }
  const plan = PLANS[tier as PlanId];
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  return {
    active: true,
    plan: { id: plan.id, name: plan.name },
    interval: row.plan_interval === 'year' ? 'year' : 'month',
    allowance: plan.counties === 'all' ? null : Math.max(Number(row.county_allowance) || 0, plan.counties),
    counties,
    exportsPerMonth: plan.exportsPerMonth,
    aiAnalyst: plan.ai,
    renewsOn: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    email: row.email,
  };
}
