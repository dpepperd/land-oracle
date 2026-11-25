# Credit wallet and postcards

Branch `feature/credit-wallet-postcards`. Not merged. Nothing here has been applied to production or the `app_prod` schema.

## What it is
- A dollar balance per account, plus a ledger row for every top-up and every charge (`db/migrations/017_wallet.sql`). Money is whole cents.
- Top-ups through Stripe Checkout (one-time payment), **test mode only**, $20 minimum. The wallet is credited by the Stripe webhook after Stripe says the payment is paid. Receipts and the Checkout page name **Fortune Oracle Media LLC**.
- Prices live in the database (`app_settings`), edited at **/admin/settings**. Starting values: skip trace $0.15, postcard $1.15, property data $0.20, permit $0.20, monitor alert $0.75. If the prices row is missing, nothing is charged.
- Postcards through Lob (**test key only**). Order: balance check, Lob US address verification, Lob creates the card, **then** the wallet is charged. A bad address stops everything: nothing sent, nothing charged, the reason is shown.
- Screen for users: **/wallet** (balance, add funds, send a postcard, history). Prices and the return address: **/admin/settings**.

## Who can see it
Admins always. Everyone else only when `WALLET_ENABLED=true` (checked on every request, so it can be switched off instantly). The skip trace flag (`SKIPTRACE_ENABLED`) is separate and untouched: the wallet does not call skip tracing.

## Safety rules built in
- A balance can never go below zero: checked under a row lock, and the table has `CHECK (balance_cents >= 0)`.
- A Stripe event, or a postcard, moves money once (idempotency keys). A top-up is credited only if the session is paid, in USD, the amount matches what was asked, and it is within $20 to $1,000.
- A live Stripe key is refused for top-ups unless `WALLET_ALLOW_LIVE=true`. A live Lob key is refused unless `LOB_ALLOW_LIVE=true`.
- One postcard send at a time per account (advisory lock). If the charge still fails after Lob accepted a card, we ask Lob to cancel it and record `sent_unpaid_cancel_requested`.

## To turn it on (nobody has done any of this)
1. Apply `017_wallet.sql` to the `app_prod` schema and grant the production role the five tables and sequences.
2. In **/admin/settings**, set the postcard **return address** (postcards stay blocked until it is set). Check the prices.
3. Set `LOB_API_KEY` (a test key) in the environment. The existing Stripe webhook endpoint already handles wallet top-ups (`checkout.session.completed`): no new endpoint is needed.
4. Check in the Stripe dashboard that the account's **business name** is Fortune Oracle Media LLC. The legal name on receipts and card statements comes from the Stripe account settings, which code cannot change; the code adds it to the Checkout page text and the payment description.
5. Before real money: decide on live keys (`WALLET_ALLOW_LIVE`, `LOB_ALLOW_LIVE`), refunds and chargebacks (not built, see below).

## Not built
- Skip trace charging the wallet (the vendor is not approved; skip trace still uses its own credits behind its flag).
- Property data, permit and monitor alert features: only their prices exist in settings.
- Refunds, disputes and chargebacks: a refund in Stripe does not yet reduce the wallet balance.
- Postcards from the parcel card (prefilled owner address): the form is on /wallet only.
- Lob webhooks (delivery tracking) and postcard history list in the UI.
- Tax, receipts by email, and an admin view of other users' wallets.
