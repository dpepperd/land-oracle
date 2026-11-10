# Post-Launch Plan (written 2026-11-09)

Production went live 2026-11-08: new pricing/billing code, production Clerk (Google sign-in works), isolated production DB
(`app_prod`, role `landoracle_prod`), Stripe live products + live webhook + customer portal, Land Oracle site chatbot
(keyword answers, no AI key needed). Owner is signed in as admin.

Rule for all phases: ONE small step at a time. Secrets are entered by the owner in Vercel/Stripe, never pasted in chat.

---

## Phase A: Close the loose ends from launch (about 30 min, owner + Claude)

| # | Who | Task |
|---|-----|------|
| A1 | Owner | Stripe -> Developers -> API keys: delete the extra secret key created on 2026-11-08 for `setup-products.js` (the newest one; keep the older one that is in Vercel). |
| A2 | Owner | Vercel -> `ADMIN_EMAILS` (Production): make sure it includes `dpepperd@gmail.com` (currently only the DB row grants admin). |
| A3 | Owner | Stripe portal (live): confirm "switch plans" lists Scout/Pro/Statewide/add-on (monthly + annual) and "cancel" is on. Add Terms/Privacy links under Settings -> Business -> Public business information (`/terms`, `/privacy`). |
| A4 | Claude | Rotate `landoracle_prod` password and set it in Vercel (Production `DATABASE_URL`); owner rotates `doadmin` in DigitalOcean. (The `landoracle_prod` URL appeared in the chat log.) |
| A5 | Both | One real low-value live purchase: Scout + `FOUNDING40` (about $47). Confirm Stripe webhook shows 200, then refund + cancel. NOTE: as admin the sync is skipped, so use a second (non-admin) account to prove tier/county entitlements. |
| A6 | Claude | Delete the parked `CLERK_SECRET_KEY` entry (id `jRWybTr0oVWCP3TC`, branch `pre-reload`) in the Vercel UI; remove the Stripe test webhook URL carrying the Vercel bypass token (or revoke the token). |
| A7 | Owner | Optional: rotate the Clerk DEV secret key (it appeared once in a chat log). |

## Phase B: Stabilize (week 1)

- Watch Vercel runtime errors daily (`get_runtime_errors`); watch Stripe webhook deliveries.
- Test in live mode: portal upgrade/downgrade/cancel, failed payment, Clerk `user.deleted` cancelling the subscription.
- Fix the open items in `docs/todo.md`: `ON DELETE CASCADE` on `leads` / `user_parcel_notes` (+ FK on `user_county_access`) in `public` AND `app_prod`; slow `/api/parcels/stats` (~22 s); `lead=undefined note=undefined` in the route smoke; bare `npm run lint` crash.
- Decide the beta-gate policy (new signups land on `/access-denied` until they subscribe).
- Add a Preview Clerk webhook (dev instance).
- DO disk limit check (DB is 46 GB).

## Phase B2: Free "motivated seller" filters + positioning (after Phase B, before paid data)

Build filters from data already in `parcels_current_nogeom` (no new data, no cost):
- Absentee owner: mailing address differs from the property (situs) address.
- Out-of-state owner: `own_state` is not FL.
- Years owned: from `sale1_date` (most recent sale); long-hold = 10+ years.
- Vacant / land: `dor_uc` / `use_code`, `year_built` empty, `acreage`, land value vs total value (`land_value`/`jv`).
- Homestead flag (`homestead`) to exclude or target non-homestead.
- Flip/recent-activity signals from the last three sales (`sale1..3_date`, `sale_prc1..3`).
- Optional saved presets, e.g. "Absentee, out-of-state, 10+ years, vacant, 5+ acres".
Positioning: sell as the Florida LAND tool (not a PropStream clone). Before buying any paid data, interview 5-10 real Florida land buyers/realtors (start with Tat) and ask what they would switch for.

## Other investor data (decide AFTER the interviews)
- Mortgage / equity estimate: license from a vendor (BatchData, ATTOM or similar); expose as filters or per-record credits.
- Liens, pre-foreclosure (lis pendens), probate, divorce: license rather than collect county by county; privacy-sensitive; only if customers ask.
- Tax delinquency: county tax collectors publish it but formats differ per county; medium-hard.
- Zoning / future land use (county GIS layers): likely MORE valuable to land buyers than mortgage data; start with the top counties.
- Building permits / code violations: hard and uneven; skip unless requested.

## Phase C: Site chatbot upgrade (small, optional)

Current bubble = keyword answers (`lib/chat-knowledge.ts`, route `/api/chat`). To make it conversational: owner creates an Anthropic Console account with credits + a spend limit, adds `ANTHROPIC_API_KEY` (Production) in Vercel. It then uses Haiku 5.5 (about half a cent per conversation). Falls back to keywords if the call fails. NOTE: a Claude Max plan does NOT cover API usage.

## Phase D: AI analysis assistant (spec: `docs/ai-analysis-spec.md`)

- Separate panel from the site bubble (owner decision). Pro + Statewide only, inside the signed-in app.
- Move the assistant route to `/api/assistant` (the spec says `/api/chat`, now used by the site bubble).
- Cost estimate (to be replaced by measured numbers): about $0.05-0.10 per question on Sonnet 5.5 with a 3-tool-call question. Starting caps proposed: Pro 150 questions/mo, Statewide 500/mo, overage pack (e.g. 100 for $15), Anthropic console spend limit as backstop, admins exempt. Bring-your-own-key: not at launch (maybe later, optional, Statewide).
- Built and live (admin-only, 2026-11-10): `/api/assistant`, question-based caps, launch switch `AI_ASSISTANT_ENABLED`, Anthropic spend limit $50/mo on the Land Oracle workspace. Measured so far (2 admin questions): about $0.009 and $0.042 per question (Sonnet 5.5), below the estimate above; keep measuring on the Clay County 5-question test.
- Scout teaser (decided 2026-11-10): Scout gets 10 free AI questions a month so the AI sells the Pro upgrade (about $0.40 per Scout user per month at the measured cost). No code needed: set `AI_CAP_SCOUT=10` in Vercel (Production) when the AI is switched on for customers; reaching the limit points to Pro. Not a paid Scout add-on for now (it could pull one-county buyers away from Pro at $199); revisit if customers or Tat say they would pay extra for the AI on a one-county plan.
- Test: 5 real realtor questions on Clay County (picked with Tat); record tool calls, tokens, cost per question. Merge only if answers are good.
- Fair housing rule stays in the system prompt: never filter or rank by owner demographics.

## Phase E: Skip tracing (owner contact data), after A-B

- What: "Skip trace" button on a parcel/lead list returns owner phones/emails from a data provider API; resold as credit packs through Stripe (optionally a small monthly allowance per plan).
- Providers to quote (get real quotes + a free test): Tracerfy (listed $0.02-$0.10/record, no charge for misses) and BatchData (reported about $0.03-$0.50/record, volume dependent). Test both on about 100 real Florida parcels before choosing.
- Our price idea: about $0.25-$0.40/record via credit packs (e.g. 100 for $30).
- Build: provider key (owner enters it), `skip_credits` balance table + Stripe credit packs, button and results on the lead, confidence labels, abuse limits. A few days of work.
- Terms: provider use restrictions passed to customers (no credit/employment/tenant screening); customers responsible for how they contact people; lawyer to review wording.
- 2026-11-10 findings (Tracerfy terms read in full, https://www.tracerfy.com/terms-of-service): the license allows "internal business use and lawful delivery to Customer's contracted end users" but prohibits reselling/sharing data with third parties or offering it as a data feed or "sublicensed product". Per-lookup charging inside our app is a gray area, so GET WRITTEN CONFIRMATION (or a white-label agreement) BEFORE building. Credits are non-refundable; no accuracy guarantee (they cite 70-95%); we indemnify them; New York law. Fit for us: Tracerfy "Normal Skip Trace" ($0.02 per hit, owner name + address in, phones/emails out; misses not charged); optional DNC Scrubbing ($0.02 per phone) and Phone Intelligence ($0.10). BatchData requires an Approved Reseller addendum for resale (batchdata.io/power-your-platform). PrimeTracers does not allow resale without a separate agreement.
- Email to ask Tracerfy first (four questions): (1) is selling lookups inside our app allowed on a standard account or do we need a reseller/white-label agreement; (2) minimums or reseller pricing; (3) what counts as a "hit"; (4) can DNC scrubbing be passed through the same way. A free test is NOT needed: 100 lookups cost about $2, so pay for the match-quality test ourselves after they say yes.
- Design rules: charge subscribers credits ONLY on a hit (same as our provider); label results "best effort" with a confidence indicator; never promise a number works; LLC/trust owners will match worse.
- STATUS 2026-11-10: owner emailed Tracerfy the reselling question; WAITING FOR THEIR WRITTEN REPLY. Do not build until they confirm (white-label/reseller agreement or written OK to charge per lookup inside our app).
- Service menu to offer (prices are suggestions; adjust to Tracerfy's reseller pricing): Standard = Normal Skip Trace (cost $0.02/hit, price about $0.25); Standard + Phone check = adds DNC/litigator/line-type check per phone (cost about $0.02 + $0.02/phone, price about $0.40); Enhanced = address history + up to 2 relatives (cost $0.30/hit, price about $1.00; hold back at launch: most sensitive data, show a warning and re-accept rules). Skip Tracerfy Advanced (we already know the owner). Sell credit packs (e.g. 100 credits for $25) so card fees do not eat small purchases; Standard = 1 credit, Standard + Phone check about 1.5, Enhanced 4.
- Credits are pay-per-use for EVERY paid plan (Scout, Pro, Statewide); no included lookups at launch; free accounts cannot buy. Optional later perk: a few free lookups on Statewide (about 25/month, roughly $0.50/month per user at Standard).
- Screens to build: (1) public `/skip-tracing-terms` page (add to `isPublicPage` in proxy.ts) + click-through window on first use; (2) lookup window on parcel popup/lead with service levels and credit prices; (3) Credits page in the dashboard (balance, buy packs via Stripe, lookup history and saved results); (4) Pricing page section "skip tracing is pay-per-use credits; charged only when we find something"; (5) update chatbot facts (`lib/chat-knowledge.ts`) once live. Backend: credits balance table, terms-acceptance table (user, time, version), charge only on a hit.
- Customer agreement: separate click-through "Skip Tracing Terms" before first use (record user, time, version; re-accept on change). First draft in `docs/skip-tracing-terms-draft.md` (NOT lawyer-reviewed; see its cheap-review options before launch). Do not edit the main Terms/Privacy pages.
- Quality: show confidence, never promise a number works; LLC/trust owners and out-of-state owners match worse.

## Phase F: Mail (postcards / letters)

- Provider: Lob (price not verified; get a quote). Resell with markup; collect payment BEFORE the batch is submitted.
- Needs: templates or a simple designer, return address, address check, proof preview + confirm step (mail can't be undone), send date, status (queued/printed/mailed). More work than skip tracing (weeks).
- Legal risk is lower than calls/texts but terms still need a lawyer's skim (truthful content, real return address).
- UPDATE 2026-11-10: provider shortlist is Stannp (primary) and Lob. Criteria from owner: simple integration, good quality and customer service, NO monthly plan on our side. Lob's and PostGrid's free tiers cap at about 500 mailings/month in total, so they would force a paid plan. Stannp: pay-as-you-go, API reportedly on the free tier, prices reported $0.55-0.82 per 4x6 (verify), US phone support (888-321-2148, support.us@stannp.com). Docs read: https://www.stannp.com/us/direct-mail-api/guide and /postcards.
- Stannp API facts (read from their docs): auth by API key (basic auth) over HTTPS; `POST /v1/postcards/create` with `size` (4x6 default), `front`/`back` images (JPG/PNG/PDF) or `template` id, `message` printed on the back, `signature`, `return_address`, `recipient[...]` (merge data), `addons` (e.g. FIRST_CLASS), `post_unverified=false` (do not mail unverifiable addresses), `tags`, `test=true` (returns a sample PDF and the exact `cost`, never dispatched, never charged); `idempotency_key` prevents double-mailing on retries; `POST /v1/postcards/cancel` before processing starts; `GET /v1/accounts/balance` (the API runs on a Bulk Mailer account with a balance, so it looks PREPAID: ask about minimum top-up); about 300 requests/minute; webhooks exist for status. Unconfirmed: whether all customers' mail may go out under our single account (reseller terms), recipient/class details.
- Decisions so far (owner, 2026-11-10): 4x6 only; 3-5 fixed fronts we supply, no design editor (own-artwork upload only if customers ask); customer types a short message on the back and supplies their own name/phone and real return address; MINIMUM ORDER 25 cards; price = Stannp cost + about 8 cents per card (Stripe's fixed fee makes 5 cents too thin on small batches). Do not offer handwritten-style or government/court-lookalike designs.
- HARD GATES (enforced SERVER-SIDE; the mail call must be refused otherwise): (1) the customer has accepted the current version of the Mailing Terms (recorded: user, time, terms_version); (2) the customer has explicitly approved the exact proof for THIS order (checkbox/typed confirm); approval is stored against a hash of the final content (front choice, message, return address, recipient list, size, price) and is INVALIDATED if anything changes; (3) payment has succeeded; (4) minimum 25 cards; (5) idempotency key per mail piece so retries cannot double-mail. Keep an immutable order record: proof PDF/URL, content hash, recipient count, price quoted, acceptance records, Stripe payment id, and Stannp ids/status. No admin shortcut around gates 1-3 except a clearly logged test mode.
- Customer agreement: `docs/mailing-terms-draft.md` (separate click-through, like Skip Tracing Terms; NOT lawyer-reviewed; see cheap-review options in docs/skip-tracing-terms-draft.md).

## Phase G: Texting (only if ever)

- Highest legal risk (federal TCPA + Florida telemarketing law) and recurring fees (10DLC brand $4.50-$46 one-time, campaign vetting $15, $2-$10/month, about $0.01/message).
- Default decision: do NOT build. The CSV export already lets customers load leads into their own texting tools, which keeps the risk with them.

## Phase H: State expansion to Georgia (late; only after Florida is proven)

Trigger: Florida has paying customers AND real buyers ask for Georgia. Do not start before Phases A-B2 are done.

UPDATE 2026-11-10: a 50-state survey is in `docs/state-data-survey.md`. Georgia is confirmed county-only (no free statewide file). Texas and North Carolina each publish free statewide parcel layers with owner + mailing address (no sale price; licenses not stated, so confirm commercial use in writing first), and are likely cheaper first expansion states than Georgia. Montana, Washington and Idaho have mailing-list/commercial-list laws: do not mail or skip-trace owners there without legal advice.

What the 2026-11-09 check found (verify before committing money):
- Georgia has 159 counties (Florida: 67). Each county assessor holds its own roll.
- The Georgia Dept of Revenue publishes tax DIGEST files, but these are aggregate values per taxing jurisdiction, not parcel-level owner records. I found no free statewide parcel+owner file.
- Aggregators advertise Georgia parcels with owner names across 159 counties (e.g. landrecords.us) but licensing/pricing was not clear and owner-name coverage varies by county. Regrid coverage/terms for Georgia were NOT confirmed. Sales history is likely patchier than Florida DOR data.

Georgia data source options (2026-11-10 check, verify before committing money):
- Nationwide parcel vendor (Regrid): sells by county/state; no public Georgia price. Get a written quote. Questions to ask: price for all 159 counties vs a few counties; license (can we resell/redistribute through a subscription app? owner names allowed?); update frequency; owner-name and mailing-address coverage by county; sales-history/last-sale fields; use/land-use codes; flood or zoning extras; API vs bulk files; term length and renewal pricing.
- Aggregators (e.g. landrecords.us): cheaper-looking, but licensing and per-county owner coverage unclear. Ask the same questions.
- Property data vendors (ATTOM, Cotality/CoreLogic): richest fields (sales, mortgage) but usually the most expensive; likely overkill for a first state.
- Individual county assessor files: some counties will sell or give their full roll if asked. Clear permitted use, but 159 separate formats. Good for a pilot with 1-2 counties.
- Schneider Geospatial / qPublic: hosts many Georgia county lookup sites. NOT a data source: no public API or bulk download, scraping terms not confirmed (third-party scrapers exist). Do not build on scraping; ask the county GIS/assessor office for a file instead.

Steps:
1. Data decision: get written quotes and sample data (3 counties, e.g. one metro, one rural, one coastal) from at least two sources (a nationwide parcel vendor such as Regrid, and an aggregator). Check license terms for resale/redistribution, owner-data restrictions, update frequency, and sales-history fields. Compare field coverage to the Florida columns in `parcels_current_nogeom` (owner name/mailing, situs, acreage, use code, values, year built, sales 1-3).
2. Storage/perf: Florida is ~40 GB. Estimate Georgia size from the sample; confirm DO disk limit and plan for indexes by state/county; fix the slow stats query first.
3. Schema: use the existing `state` column; make `parcel_key` unique across states; add a state-aware county list (159 GA counties) and per-state loaders; keep Florida data untouched.
4. App changes: remove Florida assumptions (the FLORIDA_COUNTY_COUNT, "Florida" copy, county picker, plan text, chatbot facts, Stripe product descriptions, legal pages review).
5. Pricing: 159 counties changes the math. Options: sell Georgia as its own add-on / plan (e.g. Georgia Scout/Pro) or a multi-state tier; decide with customer input. Statewide for Georgia needs its own price.
6. Filters: the free motivated-seller filters (Phase B2) may be weaker where owner/sales fields are missing; hide or label filters per state by field coverage.
7. Launch Georgia as a small beta (one or two metro counties first), then widen.
8. Rough effort: weeks if the vendor data is clean; the first extra state costs the most because it forces the app to stop assuming Florida.

---

## Competitive notes (2026-11-09 web check, verify before quoting)

- PropStream about $99/mo (Essentials) and $199/mo (Pro), nationwide, with skip tracing/outreach. DealMachine and BatchLeads are outreach-centric. Regrid sells Florida parcel data downloads.
- Land Oracle: Scout $79 / Pro $199 / Statewide $449, county-based, Florida-only, 2026 DOR roll, flood overlay. Gap: no skip tracing or outreach yet. Candidate differentiator: plain-English AI analyst (not verified whether competitors offer one).
