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
- Test: 5 real realtor questions on Clay County (picked with Tat); record tool calls, tokens, cost per question. Merge only if answers are good.
- Fair housing rule stays in the system prompt: never filter or rank by owner demographics.

## Phase E: Skip tracing (owner contact data), after A-B

- What: "Skip trace" button on a parcel/lead list returns owner phones/emails from a data provider API; resold as credit packs through Stripe (optionally a small monthly allowance per plan).
- Providers to quote (get real quotes + a free test): Tracerfy (listed $0.02-$0.10/record, no charge for misses) and BatchData (reported about $0.03-$0.50/record, volume dependent). Test both on about 100 real Florida parcels before choosing.
- Our price idea: about $0.25-$0.40/record via credit packs (e.g. 100 for $30).
- Build: provider key (owner enters it), `skip_credits` balance table + Stripe credit packs, button and results on the lead, confidence labels, abuse limits. A few days of work.
- Terms: provider use restrictions passed to customers (no credit/employment/tenant screening); customers responsible for how they contact people; lawyer to review wording.
- Quality: show confidence, never promise a number works; LLC/trust owners and out-of-state owners match worse.

## Phase F: Mail (postcards / letters)

- Provider: Lob (price not verified; get a quote). Resell with markup; collect payment BEFORE the batch is submitted.
- Needs: templates or a simple designer, return address, address check, proof preview + confirm step (mail can't be undone), send date, status (queued/printed/mailed). More work than skip tracing (weeks).
- Legal risk is lower than calls/texts but terms still need a lawyer's skim (truthful content, real return address).

## Phase G: Texting (only if ever)

- Highest legal risk (federal TCPA + Florida telemarketing law) and recurring fees (10DLC brand $4.50-$46 one-time, campaign vetting $15, $2-$10/month, about $0.01/message).
- Default decision: do NOT build. The CSV export already lets customers load leads into their own texting tools, which keeps the risk with them.

---

## Competitive notes (2026-11-09 web check, verify before quoting)

- PropStream about $99/mo (Essentials) and $199/mo (Pro), nationwide, with skip tracing/outreach. DealMachine and BatchLeads are outreach-centric. Regrid sells Florida parcel data downloads.
- Land Oracle: Scout $79 / Pro $199 / Statewide $449, county-based, Florida-only, 2026 DOR roll, flood overlay. Gap: no skip tracing or outreach yet. Candidate differentiator: plain-English AI analyst (not verified whether competitors offer one).
