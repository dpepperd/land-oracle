# Punch list: Florida launch (written 2026-11-26, updated 2026-11-27)

State now: `main` is at 577a916. Production health check is ok on all four checks. Live Stripe key is in place and a live purchase has been tested end to end. The wallet/postcards and state data survey branches are not merged.

"You" means something only the owner can do in a dashboard. "Me" means Claude does it.

## Done

| Item | Result |
|---|---|
| Clerk webhook | Live, five events listed, deliveries green. |
| Stripe webhook | Live endpoint set up, deliveries working. |
| Live purchase test | Passed 2026-11-27. Checkout unlocked the account and the first search worked. |
| Checkout unlock fix | Merged. Access turns on at the success page, no webhook wait. |
| County picker | Merged (35d755f). Unpaid signups no longer see it. |
| Confirmation banner | Merged (577a916). Shows plan, renewal date and a Manage billing link after checkout. |

## A. Must finish before Florida opens

| # | Item | Who | Notes |
|---|---|---|---|
| 1 | Stripe receipt emails | You | Settings, Business, Customer emails: turn on **Successful payments**. Settings, Billing, Subscriptions and emails: turn on invoice and renewal emails. The banner says "Your receipt is emailed", so this must be on. |
| 2 | Look at the banner on screen | You | While signed in as the subscribed test account, open `https://landoracle.ai/dashboard?checkout=success` and tell me what you see. |
| 3 | Six open decisions in `docs/florida-review.md` | You | Claude lists them in plain words, you answer yes or no, Claude applies them on a branch for your OK. |
| 4 | Stranger test | You | Checklist is in `docs/demo-kit`. Someone who has never seen the product tries to sign up and search. |
| 5 | Stripe business name | You | Confirm the Stripe account's public business name is Fortune Oracle Media LLC. Receipts take it from there. |
| 6 | Test cleanup in Stripe | You | Refund and cancel the test subscription on tatjana.vargas@gmail.com. Archive the test coupons and promo codes (Launch test 99, LAUNCHTEST99, LAUNCHTEST98). Leave FOUNDING40 alone, it is the real founder code. |
| 7 | Test cleanup in `app_prod` | Me, with your OK | Three test accounts (support@fortuneoraclemedia.com, tatjana.vargas@gmail.com, one stray Clerk example user) and their county rows. Touches production data, so I wait for your explicit OK. |
| 8 | Confirm admin list | You | Check whether Tatjana's email should be in `ADMIN_EMAILS`. She was created as a normal user. |
| 9 | Untested live paths | You and me | Cancel, failed payment and plan change have not been tried against the live webhook. Try cancel from the Manage billing page at least once. |

## B. Security cleanup, right after the above

| # | Item | Who | Notes |
|---|---|---|---|
| 10 | Rotate the `doadmin` database password in DigitalOcean | You | The old one sat in plaintext in local files. |
| 11 | Rotate the `landoracle_prod` password and update Vercel Production | Me, with you | That URL appeared in an earlier chat log. Needs a redeploy, so do it when no test is running. Check health afterwards. |
| 12 | Check for duplicate leads in production | Me | Read-only, but it touches `app_prod`, so it needs the owner's OK. |
| 13 | Vercel "readable secret" flags | You | The Development and Preview copies of `CLERK_SECRET_KEY` and `DATABASE_URL` are readable. Re-save them as sensitive in Vercel. |

## C. Soon, not blocking

| # | Item | Who | Notes |
|---|---|---|---|
| 14 | Assistant speed check | Me | Run `scripts/ai/assistant-latency.ts` against the real model. Costs a few cents, needs the owner's OK. |
| 15 | Missing Texas links (Bell, Smith, Parker) | Me | From the overnight report. |
| 16 | Delete the orphan preview deployment `land-oracle-llheqff5a` | You | Vercel dashboard. It could not be cancelled from here. |
| 17 | BatchData call, Monday 2026-11-30, 11:00 | You | Afterwards, send notes so `docs/skip-trace-vendors.md` can be updated, including the corrected BatchData price (skip trace is a fixed subscription from about $2,000 a month; the earlier $1,000 a month figure was the property-data plan). |
| 18 | Tracerfy reply | You | Forward anything they send. Resale and caching need written permission. |
| 19 | Support email choice | You | The site uses support@landoracle.ai. support@fortuneoraclemedia.com is fine for Stripe only if that inbox is monitored and a test message arrives. |

## D. Parked

- Wallet and postcards (`feature/credit-wallet-postcards`) stay unmerged and off for Florida. Going live later needs migrations 017 and 018 applied to `app_prod` with grants, and a Lob return address set.
- State data survey (`docs/state-data-survey`) is unmerged. `docs/post-launch-plan.md` says Florida is about 40 GB; measured, the Florida parcel table is 8.1 GiB (plus 6.2 GiB of DOR data), so that line needs correcting.
- Kentucky and other new states wait on the vendor answers.

## Suggested order

Items 1 and 2 first (a few minutes). Then 3 to 5, which can run in parallel. Do 6 and 7 together once you are done testing with the test accounts. Item 9 before the first real customer if you can. If these pass, Florida is launchable.
