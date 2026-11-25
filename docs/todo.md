# Land Oracle To-Do

## Product
- [ ] **AI assistant / analysis feature.** The in-app chatbot is not trained and gives generic answers. Spec is in `docs/ai-analysis-spec.md` (Option A: in-portal, tool-use, Anthropic API). Assistant code is parked on branch `feat/ai-assistant` (`e09cce2`), unmerged and untested live; needs an Anthropic key. The pricing page labels it "Coming soon" until `AI_ASSISTANT_ENABLED` is on.

## Billing / Clerk (smoke test 2026-11-08)
- [x] Stripe test webhook repointed to the stable branch URL with a protection-bypass token; verified end to end.
- [x] FOUNDING40 re-tested: $94.20/mo, persists on renewals.
- [ ] Still untested live: upgrade / downgrade / cancel via the portal (county re-pick prompt), failed payment (`4000 0000 0000 0341`).
- [ ] Clerk webhook for preview (dev instance): create endpoint, set `CLERK_WEBHOOK_SECRET` on Preview; then test `user.deleted` cancelling the Stripe subscription.
- [x] Make the sign-up fallback insert in `app/api/user/counties/route.ts` use `ON CONFLICT` (will collide with the Clerk webhook once enabled).
- [x] Pricing page: signed-out users are sent to `/sign-up`; send them to sign-in (or show both).
- [x] `/access-denied` has no link to `/pricing`: new signups hit a dead end.
- [ ] Tatjana's DB row is `role=admin` (also bypasses the beta gate): confirm intended.
- [x] `npm run lint` now lints `app lib components proxy.ts` (0 errors); the bare-`eslint` crash is gone.
- [x] `lead=undefined note=undefined` in route smoke was the smoke test failing to find its parcel, not a missing field: `is_lead` and `has_note` are returned (checked in scripts/ai/test-fl-nonadmin.ts).
- [x] `/api/parcels/stats`: cold query now reads public.county_parcel_counts (scripts/data-layers/county-counts.cjs; re-run after a Florida data load); warm answers are CDN-cached (~0.2 s).

- [x] User deletion: lib/deleteUser.ts removes notes, leads, county access, AI usage and the user in one transaction (scripts/ai/test-delete-user.ts).

## Before merging feat/pricing-v2 to main
- [ ] `main` (`cba7594`) is already contained in the branch (16 ahead, 0 behind): nothing to merge in.
- [ ] Follow `docs/go-live.md`: separate production DB, Clerk production keys/webhook/Google OAuth, Stripe live, then cutover.

## Added 2026-11-09 (see post-launch-plan.md)
- [ ] Delete the extra Stripe API key made for setup-products; rotate landoracle_prod + doadmin DB passwords; fix ADMIN_EMAILS to include the owner.
- [ ] One live purchase test with a non-admin account (Scout + FOUNDING40), then refund + cancel.
- [ ] Site chatbot is keyword-only; optional ANTHROPIC_API_KEY upgrades it (Haiku 5.5).
- [ ] AI assistant: use /api/assistant (not /api/chat); caps + cost test (Clay County, 5 questions).
- [ ] Skip tracing (quotes from Tracerfy + BatchData, then build), then mail (Lob). Texting: do not build by default.

## Florida production readiness (2026-11-25)
- [x] Production role could not read schema `dor` (logged "permission denied for schema dor" on /api/parcels/search, 9 times Nov 17-20): affected Florida search by parcel id/address, parcel detail and export. Fixed with scripts/launch/grant-dor-read.cjs (USAGE on dor, SELECT on dor.nal_2026 only). Re-run it if the production role is ever re-created.
- [x] `/api/health` (public, ok/fail per key table; 503 when broken). Point an uptime monitor at it, e.g. https://landoracle.ai/api/health, with email alerts.
- [x] Daily search count per account (user_usage_searches, shown in the admin panel) to back the refund policy's "substantially used" clause. Records only, never blocks.
- [x] /api/assistant timeout (Nov 20): see branch fix/assistant-timeout. The model loop had no time budget (6 calls, 16k-token cap, medium effort); now soft 60 s / hard 95 s limits, 25 s per tool, low effort by default, 6k-token cap, plain message in the chat window. NOT yet measured against the live model (no paid calls were made overnight): run one real question and watch the "[assistant] ..." log line.
