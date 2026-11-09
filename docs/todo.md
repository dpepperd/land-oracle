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
- [ ] `npm run lint` (bare `eslint`) crashes on a config quirk (`react-hooks` plugin not found when linting non-app files); `eslint app lib components proxy.ts` is clean (0 errors).
- [ ] Route smoke prints `lead=undefined note=undefined` for the search is_lead/has_note flags; check those fields are really returned.
- [ ] `/api/parcels/stats` took ~22 s in the smoke run; investigate (public endpoint).

- [ ] `leads` and `user_parcel_notes` have FKs to `users` WITHOUT `ON DELETE CASCADE`, and `user_county_access` has no FK: the Clerk `user.deleted` webhook will 500 for a user with leads/notes and leave orphan county rows. Add cascades (in `public` and `app_prod`).

## Before merging feat/pricing-v2 to main
- [ ] `main` (`cba7594`) is already contained in the branch (16 ahead, 0 behind): nothing to merge in.
- [ ] Follow `docs/go-live.md`: separate production DB, Clerk production keys/webhook/Google OAuth, Stripe live, then cutover.

## Added 2026-11-09 (see post-launch-plan.md)
- [ ] Delete the extra Stripe API key made for setup-products; rotate landoracle_prod + doadmin DB passwords; fix ADMIN_EMAILS to include the owner.
- [ ] One live purchase test with a non-admin account (Scout + FOUNDING40), then refund + cancel.
- [ ] Site chatbot is keyword-only; optional ANTHROPIC_API_KEY upgrades it (Haiku 5.5).
- [ ] AI assistant: use /api/assistant (not /api/chat); caps + cost test (Clay County, 5 questions).
- [ ] Skip tracing (quotes from Tracerfy + BatchData, then build), then mail (Lob). Texting: do not build by default.
