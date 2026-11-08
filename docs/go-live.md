# Go-Live Checklist

Production (`landoracle.ai`, branch `main`) is currently wired to **dev/test everything**: the Clerk *development* instance
(`in-anemone-12`, `pk_test_…`), Stripe **test** keys, and the **same database** as preview/local. None of that can serve real
customers. Do the phases below in order. Don't merge `feat/pricing-v2` to `main` until phases 1-3 are done, because a merge
deploys production.

## Status as of 2026-11-08
- Billing logic: 26/26 offline cases pass; a real test-mode checkout with `FOUNDING40` produced $94.20/mo (40% off, forever), the webhook synced tier/counties for a non-admin user.
- Clerk webhook logic: 9/9 offline cases pass (never run against a real Clerk endpoint yet).
- Route smoke (search/export/notes/leads/stats) passes; `tsc` clean; app source lints with 0 errors.
- `main` (`cba7594`) is already contained in `feat/pricing-v2` (16 ahead, 0 behind), so the merge is a fast-forward.
- Clerk **production** instance exists on `landoracle.ai` (`pk_live_…` -> `clerk.landoracle.ai`); its 5 DNS records are verified. Not yet wired into Vercel.

---

## Phase 1: Separate the production database from preview (do before cutover)

**Why.** `DATABASE_URL` is one Vercel entry shared by Development, Preview and Production. Test sign-ups, test Stripe
customers and the simulation scripts all write to the same `users` table that production would use. A `user.deleted` event
from the *dev* Clerk instance also cancels Stripe subscriptions looked up in that table.

**What's in the 46 GB.** Parcel/reference data is ~40 GB and read-only to the app: `parcels` (21 GB), `flood_hazard` (11 GB),
`parcels_v2` (8 GB), plus `traffic_stats`, `highways`, `us_roads`, `interstates`, `county_codes`, the FEMA caches and the
`parcels_current*` / `parcel_sales_current` views. The app-owned tables are tiny (< 1 MB total): `users`, `stripe_events`,
`user_county_access`, `leads`, `user_parcel_notes`, `user_usage_exports`, `user_usage_searches`, `export_usage`, `ai_usage`,
`demo_sessions`.

**Recommendation: schema isolation, not a second 46 GB copy.**
Searches join user data (lead/note flags) to parcel data by `parcel_key`, and Postgres can't join across databases, so
splitting into two databases would need a code rewrite. Instead keep one cluster/database and isolate the app tables:

1. Create schema `app_prod` and recreate the app tables in it, empty (schema-only dump of the tables above, restored into
   `app_prod`). Production starts with zero users, which is correct. Nothing needs migrating.
2. Create a dedicated Postgres role `landoracle_prod` with a **new strong password**:
   - `USAGE` + full rights on `app_prod`,
   - `SELECT` only on the parcel/reference tables and views in `public`,
   - `ALTER ROLE landoracle_prod SET search_path = app_prod, public;` (set on the role, not in the URL, so it also works through
     DigitalOcean's connection pooler, which ignores startup options).
3. Production gets its own `DATABASE_URL` (that role) scoped to **Production only**. Preview and Development keep the current
   URL and the existing `public` tables, so test users never touch production data.
4. Rotate the DigitalOcean admin password at the same time (it previously sat in plaintext in local files).
5. Verify before cutover: connect as `landoracle_prod`, `SELECT count(*) FROM users` is 0 and `SELECT current_schema()` is
   `app_prod`; a parcel search works; an `INSERT` into a parcel table is refused.
6. Use the DO console to check the disk limit (the DB is 46 GB; launch added ~6 GB of staging data). Drop `staging`/`dor`
   leftovers only after confirming nothing references them.

Alternative if you'd rather have hard separation: a second managed cluster holding only the app tables, with the app reading
parcels from a read replica. It needs a two-pool code change plus app-side joins, so it is more work for little extra safety at this size.

---

## Phase 2: Clerk production instance

### 2a. Google sign-in with your own credentials (required in production)
Clerk's shared Google credentials only work in development. In production you must create your own Google OAuth client.
You need to create (Google's console labels change; Clerk's **SSO connections -> Google -> Use custom credentials** page shows the
exact values to copy):

1. A Google Cloud project (e.g. "Land Oracle") at console.cloud.google.com.
2. **Google Auth Platform -> Branding** (OAuth consent screen): app name "Land Oracle", user support email, developer contact email,
   authorized domain `landoracle.ai`, privacy policy `https://landoracle.ai/privacy`, terms `https://landoracle.ai/terms`.
3. **Audience:** External, then **publish to "In production"**. Left in "Testing", only listed test users can sign in and
   refresh tokens expire after 7 days.
4. **Data access / scopes:** only `openid`, `email`, `profile`. These are non-sensitive, so no Google verification review is needed.
5. **Clients -> Create client -> Web application.** Under **Authorized redirect URIs** add the exact redirect URI Clerk shows
   (expected: `https://clerk.landoracle.ai/v1/oauth_callback`). Add any authorized JavaScript origin Clerk lists (typically none).
6. Copy the **Client ID** and **Client secret** into the Clerk production instance (Google connection -> custom credentials).
   The secret goes into Clerk only: never into chat, the repo, or Vercel.
7. Test in a private window on `https://landoracle.ai/sign-in`: "Continue with Google" completes and returns to the site.

### 2b. Webhook endpoint (production instance)
- Clerk dashboard (Production instance) -> Webhooks -> Add endpoint: `https://landoracle.ai/api/webhooks/clerk`,
  events `user.created`, `user.updated`, `user.deleted`. Copy the signing secret.
- This endpoint belongs to the production instance only. Do **not** add a production URL to the development instance (it would
  receive every preview test event). Preview gets its own endpoint on the dev instance with its own secret.

### 2c. Vercel environment variables (Settings -> Environment Variables)
The existing Clerk and database entries cover all three environments, so for each one **edit it and untick Production**, then add
a **Production-only** entry with the new value. Enter secrets in the Vercel UI yourself.

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_Y2xlcmsubGFuZG9yYWNsZS5haSQ` |
| `CLERK_SECRET_KEY` | the production `sk_live_…` |
| `CLERK_WEBHOOK_SECRET` | signing secret from 2b |
| `ADMIN_EMAILS` | your verified admin email(s), comma-separated |
| `DATABASE_URL` | the `landoracle_prod` URL from phase 1 |

Preview/Development keep the `pk_test`/`sk_test` keys. Production users start empty: you sign up again on `landoracle.ai`
and become admin through `ADMIN_EMAILS` (the user table is unique on `clerk_id`, not email, so your old dev-instance row is unaffected).

---

## Phase 3: Stripe live mode
- [ ] Replace production `STRIPE_SECRET_KEY` with the live key (`sk_live_…`). Production currently holds a **test** key.
- [ ] Create the live webhook endpoint (live mode): `https://landoracle.ai/api/webhooks/stripe`, events
  `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Replace production `STRIPE_WEBHOOK_SECRET` with that endpoint's signing secret (it currently holds the **test** value).
- [ ] Run `node scripts/stripe/setup-products.js --live` with the live key in `STRIPE_SECRET_KEY` (creates products, `lookup_key`
  prices and the `FOUNDING40` coupon/promo code in live mode; safe to re-run).
- [ ] Enable plan switching and cancellation in the live Stripe customer portal settings.
- [ ] Test-mode cleanup: delete the preview webhook URL that carries the Vercel protection-bypass token, or revoke that token.

---

## Phase 4: Cutover
1. Phases 1-3 done and verified.
2. `main` is already contained in the branch; merge `feat/pricing-v2` into `main` (fast-forward). This deploys production with the new
   code and the new Production-scoped variables together.
3. **Do not push to `main` earlier than this with the new variables in place**: any production deploy picks them up.
4. Decide the beta gate: new signups land on `/access-denied` until they subscribe (the Stripe webhook sets `beta_access`).
   Make sure that page links to `/pricing` first.

## Phase 5: Verify in production
- [ ] `https://landoracle.ai/sign-in` loads the production Clerk (no "Development mode" badge), Google sign-in works.
- [ ] Sign up; confirm a `users` row appears (Clerk webhook, `[stripe-…]`/`User created` in the Vercel log) and that your account
  is admin via `ADMIN_EMAILS`.
- [ ] `/pricing` shows the founding banner; a real low-value live purchase completes, tier/counties update, the Stripe webhook
  shows 200, then refund and cancel it.
- [ ] Delete a throwaway user in Clerk and confirm its Stripe subscription is cancelled and its row removed.
- [ ] Footer/legal pages and contact details look right.

## Rollback
Vercel -> Deployments -> promote the previous production deployment (`dpl_DSJhJkpxC8bACZPaPQbr2Ni5faBs`, commit `cba7594`).
Environment variable changes don't roll back with a deployment: revert the Production-scoped entries by hand.

See `.env.example` for variable descriptions.
