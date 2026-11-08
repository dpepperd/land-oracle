# Land Oracle To-Do

## Product
- [ ] **AI assistant / analysis feature.** The in-app chatbot is not trained and gives generic answers. Spec is in `docs/ai-analysis-spec.md` (Option A: in-portal, tool-use, Anthropic API). Assistant code is parked on branch `feat/ai-assistant` (`e09cce2`), unmerged and untested live; needs an Anthropic key. The pricing page labels it "Coming soon" until `AI_ASSISTANT_ENABLED` is on.

## Billing (found during preview smoke test, 2026-11-08)
- [ ] Stripe test webhook points at an old deployment URL and preview deployments are behind Vercel login protection; fix with a stable branch URL plus protection-bypass token, then resend the pending `checkout.session.completed`.
- [ ] Re-test FOUNDING40 at checkout (first test charged full $157, no discount applied).
- [ ] Switch pricing-page signed-out redirect from `/sign-up` to `/sign-in` (or add a visible sign-in link).

## Before merging feat/pricing-v2 to main
- [ ] `main` has a new commit (`cba7594`, Traffic label) that the branch lacks; merge/rebase first.
- [ ] See `docs/go-live.md` for the production cutover checklist.
