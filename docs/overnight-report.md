# Overnight report: 2026-11-25 into 2026-11-26

All three tasks were done. Nothing was merged, nothing was deployed by hand, and production and the `app_prod` schema were not touched.
Production still runs `main` at `e7d791a`. Check at the end of the run: `https://landoracle.ai/api/health` returned all four checks ok, and the home page returned 200.

## The three branches

| Task | Branch | Last commit | Merge it? |
|---|---|---|---|
| 1. Assistant timeout | `fix/assistant-timeout` | `64c223f` | Yes after one real-model check (below). Touches `lib/ai/run.ts`, `lib/ai/prompt.ts`, `app/api/assistant/route.ts`, `components/assistant/AssistantPanel.tsx`, `docs/todo.md`, two test/script files. |
| 2. Skip trace scaffold | `feature/skip-trace-scaffold` | `590b63e` | Safe to merge: the flag is OFF and nothing is visible. It does nothing in production until the steps in `docs/skip-trace.md` are done. |
| 3. Demo kit | `docs/demo-kit` | see git log | Docs only. This report is on this branch too. |

The three branches change different files, so they can be merged in any order. Each branch was cut from `main`, got the full set of suites plus `next build`, and passed.
Test counts at the last full run: every suite 0 real failures, build compiled successfully. New tests: 12 checks for the assistant time budget, 29 for skip tracing.

**Side effects you should know about**
- Pushing a branch makes Vercel build a **preview** deployment automatically. Previews exist for `fix/assistant-timeout`, `feature/skip-trace-scaffold` and `chore/fl-production-ready` (all built fine). They are previews, not production. They use the development database and the development login.
- The skip trace test created three new tables (`skip_trace_credits`, `skip_trace_cache`, `skip_trace_lookups`) in the **development** `public` schema, which lives on the same database server as production. Production does not read them (the feature is off, and the production role has no access to them). The test removes its own rows.
- Nothing was written to `app_prod`. No services were signed up for, and no model calls were made (no money spent): the assistant test uses a fake model.

## Task 1: assistant timeout (`fix/assistant-timeout`)

**What the logs showed.** On Nov 20 around 03:18 to 03:20 UTC, the assistant answered three questions for an admin account, one of them with two model calls producing 7,473 output tokens. The request that timed out at 120 seconds (03:20:30) never got to write its own log line, because the platform killed it. So the exact cause of that one request is inferred, not seen.

**The cause (best reading).** The assistant's loop had no time budget at all: up to 6 model calls, each allowed up to 16,000 output tokens at "medium" effort, with nothing but the platform's 120 second kill to stop it, and no limit on a single data lookup. A long answer plus a couple of tool rounds can exceed 120 seconds. It was **not** caused by the `dor` permission bug: the assistant's tools do not use that table. The data queries already had their own time limit.

**What changed**
- A **soft limit of 60 seconds**: after that, the next model call is the final answer (tools turned off).
- A **hard limit of 95 seconds**: the call is cut off and the user sees a plain message ("That question took longer than expected, so I stopped. Try a narrower question…"); any text already shown stays.
- **Each data lookup is capped at 25 seconds** and reports a timeout to the model instead of hanging the loop.
- **Faster defaults:** effort is now `low` (was `medium`) and the answer cap is 6,000 tokens (was 16,000). Both can be changed with the Vercel settings `ANTHROPIC_EFFORT` and `ANTHROPIC_MAX_TOKENS`. The prompt now asks for answers under about 250 words with tables of at most 10 rows.
- **The chat window** no longer hangs: if the connection ends without the server's final message, or goes quiet for 100 seconds, it shows the same plain message.

**Test.** `scripts/ai/test-assistant-timeout.ts` (12 checks, no cost): a normal run is unchanged; a model call that never finishes stops at the deadline with the friendly message and keeps the text already streamed; a hung data lookup becomes a timeout result and the run still answers; running out of soft time forces a final answer; closing the chat ends the run quietly.

**NOT verified: the "under 20 seconds" goal.** I made no real model calls (that spends money), so I can't tell you a measured time. The changes (low effort, smaller cap, shorter answers) should help a lot, but that is expectation, not measurement. To measure: `npx tsx scripts/ai/assistant-latency.ts` runs three typical questions against the real model and the development data and prints seconds, tool calls and cost for each (about a few cents in total). It is not part of any suite. Run it before merging. If answers feel too thin at `low` effort, set `ANTHROPIC_EFFORT=medium` in Vercel: the time limits still protect you.

## Task 2: skip trace scaffold (`feature/skip-trace-scaffold`)

Full description: `docs/skip-trace.md`. Vendor comparison: `docs/skip-trace-vendors.md`.

**Built**
- A vendor-neutral provider interface, plus a **mock provider** that invents obviously fake contacts. The mock **refuses to run in production**, so real customers can never be shown fake numbers.
- A **"Get owner contact" button** on the Florida parcel card. It shows nothing at all unless the switch `SKIPTRACE_ENABLED=true` is on, so it is invisible now. (Only the results-list card has it, not the map popup.)
- **Credits per account** with a ledger, and a **shared cache** so the vendor is never paid twice for the same owner (misses are cached too).
- An API route (`/api/skiptrace`) that answers 404 while the switch is off.
- A script to give an account credits by hand (`scripts/launch/skiptrace-grant.cjs`).

**The money rules, each tested (29 checks, repeatable)**
- The vendor is called at most once per owner, across all accounts.
- An account is charged 1 credit only for a hit, and only the first time it sees that owner. Repeats, misses and vendor failures are free.
- With 0 credits the vendor is never called. A saved miss, or a result the account already paid for, can still be read.
- A double click cannot charge twice or call the vendor twice.
- A parcel outside the account's county plan is refused with no charge. Signed-out requests get 401.
- Admins get no free pass (every lookup costs real money).
- Deleting a user removes their credits and ledger.

**Decisions I made that you may want to change**
- Credits are charged per **hit** because vendors bill per hit. A saved result from another account's lookup still costs the second account 1 credit once (we only paid the vendor once, but each account pays for what it sees). If you would rather make saved results free, it is one line in `lib/skiptrace/service.ts`.
- The cache lasts 180 days.
- Phone numbers and emails are never written to logs.

**NOT done on purpose:** no real vendor, no credit purchase flow, nothing in `app_prod`. Before turning it on you must run `db/migrations/016_skip_trace.sql` in the production schema, grant the production role access, pick a vendor, and have a lawyer review the compliance notes. The step-by-step list is in `docs/skip-trace.md`.

**Vendor research (public pages only, nothing confirmed with any vendor).** Summary: Tracerfy is the cheapest published ($0.02 per successful hit, API access, no minimum, but its own pages disagree on prices). BatchData has no published per-record rate and its public plans start around $1,000 a month. Enformion (formerly Endato) is quote-only. REISkip's $0.15 comes from a competitor's blog and I found no API. The Apify "skip trace" tools are scrapers and I recommend against them. Melissa, People Data Labs and Whitepages Pro returned nothing useful. All prices are marketing-page figures. Get written quotes before relying on any number.

## Task 3: demo kit (`docs/demo-kit`)

- `docs/demo-script.md`: a 10-minute broker demo (problem, area search and filters, seller signals, AI moment, export and plans, the pilot offer) with a "what to do if something breaks" section.
- `docs/cant-do-yet.md`: a plain one-page list of what Land Oracle does not do yet (no owner contacts, Florida-only for customers, county plans, assessed value is not market value, data only as fresh as the roll, no saved searches or alerts, no CRM or team seats, AI limits).
- `docs/stranger-test-checklist.md`: the exact sign-up and payment steps for your test (sign up, phone check, pay for Scout with a real card, upgrade, downgrade, cancel, refund, what to write down, and what to clean up afterwards).

I wrote these from the code. I checked the button and page names against the real screens (for example "Mark as Lead", "Export CSV", "Manage Subscription" on the Support page, and the pricing buttons "Get Scout" and so on), and the prices and limits against the plan definitions. I could not check the real pages signed in.

**Two things to check by eye:** (1) the checklist assumes the free-account export and AI Analyst messages are polite and not errors: that is exactly what the test is for; (2) the demo script says the AI Analyst needs a Pro or Statewide account: check which plan your demo account is on.

## Still open (not touched overnight)
- The Bell, Parker, Smith, Lubbock and Johnson property-page URLs for the Texas links, and a new Hays link.
- The live purchase test, the key and password rotation, and Tatjana's admin check (see `docs/todo.md`).
- Merge decisions on the three branches above.

## Suggested order this morning
1. Run `npx tsx scripts/ai/assistant-latency.ts` (a few cents) and read the times.
2. Merge `fix/assistant-timeout` if they look right, then the other two when you are ready (they are independent).
3. Do the stranger test from `docs/stranger-test-checklist.md`.
4. Send me what you find.
