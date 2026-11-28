# Credit wallet and postcards

Branch `feature/credit-wallet-postcards`. Not merged. Nothing here has been applied to production or the `app_prod` schema.

## What it is
- **Wallet:** a dollar balance per account plus a ledger row for every top-up and charge (`017_wallet.sql`). Money is whole cents.
- **Top-ups:** Stripe Checkout (one-time payment), **test mode only**, $20 minimum. The wallet is credited by the Stripe webhook after Stripe says the payment is paid. The Checkout page and payment description name **Fortune Oracle Media LLC**.
- **One door for every paid service:** `lib/wallet/charge.ts` `chargeForService()`. The price comes from admin settings, a switched-off item cannot be charged, and a balance can never go below zero. Postcards use it now; skip trace, property data, permits and monitor alerts can use it later without new money code.
- **Prices in admin settings** (`/admin/settings`, stored in `app_settings`, never in code). Each item has a price and an on/off switch:

| Item | Starting price | Switch |
|---|---|---|
| Postcard 4×6 (default) | $1.15 | on |
| Postcard 6×9 | $1.30 | on |
| Postcard 6×11 | $1.55 | on |
| Skip trace | $0.15 | **off** (placeholder, vendor not approved) |
| Property data | $0.20 | **off** (placeholder) |
| Permit | $0.20 | **off** (placeholder) |
| Monitor alert | $0.75 | **off** (placeholder) |

- **Postcards (Lob, test key only, First Class for every size):** order is spendable-balance check, Lob US address verification, the price is **held** (reserved), Lob creates the card, **then** the hold becomes the charge. A bad address stops everything: nothing sent, nothing held or charged, the reason is shown. If Lob refuses the card the hold is released.
- **Screens:** `/postcards` (size, design, details, upload, preview, send), `/wallet` (balance, add funds, history), `/admin/settings` (prices, return address).

## Holds: reserve, settle, release (`020_wallet_holds.sql`)
Any service that spends OUR money before it knows the outcome (a skip trace vendor call, a Lob card) uses three steps in `lib/wallet/charge.ts`:
- `reserveForService()` sets the price (times quantity) aside. The balance is unchanged and nothing is written to the ledger, but spendable money (`balance - held`) drops, so no other spend, direct charge or reservation can take it.
- `settleHold()` on success turns the hold into one `charge` ledger row, at the reserved amount or less (`actualCents`).
- `releaseHold()` on a miss or failure makes the money spendable again. No ledger row: it never left the balance.
Every step is idempotent (one hold per postcard or lookup however often it is retried), the database refuses `held_cents > balance_cents`, and a hold nobody closes (a crash) expires after 10 minutes and is freed the next time that account reserves. `keepHold()` marks a hold that needs a person (it never expires). The wallet screen and `/api/wallet` show spendable money as the balance, plus `heldCents`.
This is the shared mechanism for skip trace, postcards and later items (property data, permits, monitor alerts). Tests: `scripts/ai/test-wallet.ts` (reserve, settle, release, partial settle, races, expiry, one balance shared by a lookup and a postcard).

## Postcard sizes, designs, templates
- Sizes **4×6 (default), 6×9, 6×11**. Each is priced separately in settings.
- Three starter designs, **Classic, Bold, Friendly**, each laid out for all three sizes: **9 HTML templates** in `lib/wallet/templates.ts`. Art is placeholder (CSS and inline SVG; no external files or fonts).
- The user edits the **back message** and can upload a **logo** and a **photo**. The photo replaces the placeholder art on the front; the logo goes on the back (and the front).
- **Merge fields:** `{{owner_name}}`, `{{property_address}}`, `{{acreage}}`. A field used in the message but left empty, or an unknown one, is refused (never mailed as raw text). The front headline uses the same fields and falls back to "your property" / "your land".
- **Required:** agent name, agent phone (a real US number), brokerage name.
- **Preview before sending:** `/api/postcards/preview` returns the exact front and back HTML that would go to Lob (one renderer builds both the preview and the real card), plus the price and whether the balance covers it. It is free: no Lob call, nothing saved.
- **Uploads:** PNG or JPEG only (checked by the file's bytes), under 4 MB, resized, rotated upright and re-encoded (this removes camera data including GPS), saved against the account and usable only by it. Images are embedded in the card HTML, so Lob never needs a public link to a user's file.

### Layout facts and what is verified
- The **address area on the back** (Lob prints the address and postage there) is from Lob's published spec: 4×6 is 3.2835 × 2.375 in, other sizes 4 × 2.375 in, 0.275 in from the right edge and 0.25 in from the bottom, including bleed. Nothing of ours is placed inside it, and the back is white (tested for all 9 templates).
- **File sizes with bleed** (6.25×4.25, 9.25×6.25, 11.25×6.25 in) are the standard trim plus 0.125 in bleed. They are **not** stated on Lob's spec page (they are in Lob's PDF templates, which were not opened): check one real proof from Lob before mailing for real.

## Who can see it
Admins always. Everyone else only when `WALLET_ENABLED=true` (checked on every request, so it can be switched off instantly). Skip trace stays behind `SKIPTRACE_ENABLED`; the wallet does not call it.

## Safety rules built in
- A balance can never go below zero: checked under a row lock, and the table has `CHECK (balance_cents >= 0)`.
- A Stripe event, or a postcard, moves money once (idempotency keys). A top-up is credited only if the session is paid, in USD, the amount matches what was asked, and it is within $20 to $1,000.
- A live Stripe key is refused for top-ups unless `WALLET_ALLOW_LIVE=true`. A live Lob key is refused unless `LOB_ALLOW_LIVE=true`.
- One postcard send at a time per account. The price is held before Lob is called, so nothing else can spend that money while the card is made. If the charge cannot be completed after Lob accepted a card, the card stays sent (it is not cancelled) and the held money stays held, marked for a person to settle (`wallet_holds.close_reason`). Older rows may show `sent_unpaid_cancel_requested` from before holds existed.
- The user is charged the price shown in the preview for that size.

## Margins (owner's numbers, First Class)
| Size | Costs us | Plus Stripe | We charge | We keep |
|---|---|---|---|---|
| 4×6 | $0.909 | about 96¢ | $1.15 | about 19¢ |
| 6×9 | $1.030 | about $1.08 | $1.30 | about 22¢ |
| 6×11 | $1.294 | about $1.36 | $1.55 | about 19¢ |

Standard (marketing) class is a little cheaper on the big sizes but slower and meant for bulk, and 4×6 is First Class only, so everything goes First Class.

## To turn it on (nobody has done any of this)
1. Apply `017_wallet.sql`, `018_postcard_sizes.sql` then `020_wallet_holds.sql` to the `app_prod` schema and grant the production role the tables and sequences.
2. In **/admin/settings**, set the postcard **return address** (postcards stay blocked until it is set). Check the prices.
3. Set `LOB_API_KEY` (a test key). The existing Stripe webhook already handles wallet top-ups: no new endpoint.
4. Check that the Stripe account's **business name** is Fortune Oracle Media LLC. The legal name on receipts and card statements comes from the Stripe account settings, which code cannot change.
5. Before real money: decide on live keys (`WALLET_ALLOW_LIVE`, `LOB_ALLOW_LIVE`), refunds and chargebacks (not built, see below).

## Not built
- Skip trace charging the wallet (vendor not approved; skip trace still uses its own credits behind its flag).
- The property data, permit and monitor alert features: only their (switched-off) prices exist.
- Refunds, disputes and chargebacks: a refund in Stripe does not yet reduce the wallet balance.
- Prefilled postcards from a parcel card (the `/postcards` page accepts `?owner=&address=&acres=` but nothing links there yet).
- Real artwork (all art is placeholder), Lob delivery tracking, postcard history list in the UI.
- Tax, emailed receipts, and an admin view of other users' wallets.
