# Punch list: Florida launch (written 2026-11-26)

State when written: `main` is at 4defa72. Production health check is ok on all four checks. The checkout unlock fix and the fake Contact Info removal are merged and live. The wallet/postcards and state data survey branches are not merged.

"You" means something only the owner can do in a dashboard. "Me" means Claude does it.

## A. Must finish before Florida opens

| # | Item | Who | Notes |
|---|---|---|---|
| 1 | Clerk webhook check | You | Clerk production instance, Webhooks. URL must be `https://landoracle.ai/api/webhooks/clerk` with user.created, user.updated and user.deleted. Send a test event and confirm 200. A 400 means the secret in Vercel does not match Clerk's. Never paste the secret in chat. |
| 2 | Stripe webhook check | You | Stripe dashboard (live mode), Webhooks. Endpoint should be `https://landoracle.ai/api/webhooks/stripe` with checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted and invoice.payment_failed. Report what you see, no secrets. |
| 3 | Live purchase test | You and me | The biggest unknown. Fresh Gmail signup, cheapest plan (coupon if available), pay, confirm the dashboard opens. Claude watches Vercel logs and the account row. Refund the charge afterwards. |
| 4 | Six open decisions in `docs/florida-review.md` | You | Claude lists them in plain words, you answer yes or no, Claude applies them on a branch for your OK. |
| 5 | Stranger test | You | Checklist is in `docs/demo-kit`. Someone who has never seen the product tries to sign up and search. |
| 6 | Stripe business name | You | Confirm the Stripe account's public business name is Fortune Oracle Media LLC. Receipts take it from there. |

## B. Security cleanup, right after the purchase test passes

| # | Item | Who | Notes |
|---|---|---|---|
| 7 | Rotate the `doadmin` database password in DigitalOcean | You | The old one sat in plaintext in local files. |
| 8 | Rotate the `landoracle_prod` password and update Vercel Production | Me, with you | That URL appeared in an earlier chat log. Needs a redeploy, so do it when no test is running. Check health afterwards. |
| 9 | Check for duplicate leads in production | Me | Read-only, but it touches `app_prod`, so it needs the owner's OK. |

## C. Soon, not blocking

| # | Item | Who | Notes |
|---|---|---|---|
| 10 | Assistant speed check | Me | Run `scripts/ai/assistant-latency.ts` against the real model. Costs a few cents, needs the owner's OK. |
| 11 | Missing Texas links (Bell, Smith, Parker) | Me | From the overnight report. |
| 12 | Delete the orphan preview deployment `land-oracle-llheqff5a` | You | Vercel dashboard. It could not be cancelled from here. |
| 13 | BatchData call, Monday 2026-11-30, 11:00 | You | Afterwards, send notes so `docs/skip-trace-vendors.md` can be updated, including the corrected BatchData price (skip trace is a fixed subscription from about $2,000 a month; the earlier $1,000 a month figure was the property-data plan). |
| 14 | Tracerfy reply | You | Forward anything they send. Resale and caching need written permission. |

## D. Parked

- Wallet and postcards (`feature/credit-wallet-postcards`) stay unmerged and off for Florida. Going live later needs migrations 017 and 018 applied to `app_prod` with grants, and a Lob return address set.
- State data survey (`docs/state-data-survey`) is unmerged. `docs/post-launch-plan.md` says Florida is about 40 GB; measured, the Florida parcel table is 8.1 GiB (plus 6.2 GiB of DOR data), so that line needs correcting.
- Kentucky and other new states wait on the vendor answers.

## Suggested order

Items 1 and 2 first thing (about 10 minutes, and they gate everything), then item 3 together. Items 4 to 6 can run while waiting on the test. If items 1 to 3 pass, Florida is launchable pending the answers on item 4.
