# Skip tracing (owner phone / email lookup): how it works

Status: **built on the wallet, tested with a fake vendor, OFF.** No real vendor is connected, nothing is applied to production, and no customer can see the button.
First written 2026-11-25 (`feature/skip-trace-scaffold`); moved onto the wallet 2026-11-28 (`feat/skiptrace-wallet`, stacked on `feat/wallet-reserve` and `feature/credit-wallet-postcards`). Vendor options and prices: `docs/skip-trace-vendors.md`; what to ask a vendor: `docs/vendor-call-checklist.md`. The wallet itself: `docs/wallet.md`.

## What a user sees (only when the flag is on and a price is set)
A **Get owner contact** button on each Florida parcel card (hidden for other states and whenever the flag is off). The button shows the price, for example "Get owner contact ($0.15)", and the wallet balance, and says it is only charged if a contact is found. Clicking it shows possible phone numbers (with type) and emails, how much was charged, and the new balance, with a reminder that contacts are unverified. With too little money it says so and links to `/wallet` to add funds.
**Do Not Call (DNC) check:** depending on the admin's setting it is **off** (not sold), **optional** (a tick box "Include Do Not Call check (+$0.05)"), or **required** (every lookup includes it and the button shows the combined price). When included, each phone shows "Do Not Call" or "not on Do Not Call list" and the date the status was checked.

## What can be bought (the menu)
Each thing is a priced item in admin settings (`/admin/settings`): a price in dollars and an on/off switch. Nothing is priced in code.
| Item | Wallet item name | Default |
|---|---|---|
| Owner contact (phones, emails) | `skip_trace` | $0.15 placeholder, **off** until a vendor and its cost are known |
| Do Not Call check (add-on) | `skip_trace_dnc` | $0 / **off** (older saved prices without it count as off) |
The DNC mode (off / optional / required) is a second admin setting (`app_settings` key `skiptrace_options`, missing = off). A vendor declares what it can do (`capabilities`, for now just `dnc`); an add-on is only sold when the active vendor supports it. Property data and permits will be further items in the same list when a vendor offers them.

## The pieces
| Piece | File |
|---|---|
| The on/off flag, owner key, holds and charging, caching, DNC freshness | `lib/skiptrace/service.ts` |
| Vendor interface and capabilities (plug a vendor in here) | `lib/skiptrace/types.ts` (`SkipTraceProvider`) |
| Which vendor is used | `lib/skiptrace/providers.ts` (`SKIPTRACE_PROVIDER`) |
| Fake vendor for tests and local work (refused in production) | `lib/skiptrace/mock.ts` |
| API: `GET /api/skiptrace` (enabled? prices, balance, DNC option), `POST /api/skiptrace {parcel_key, dnc?}` | `app/api/skiptrace/route.ts` |
| The button | `components/dashboard/OwnerContact.tsx`, used in `ParcelCard.tsx` |
| Prices and the DNC mode | `/admin/settings`, `lib/wallet/settings.ts` |
| Tables | `db/migrations/016_skip_trace.sql`, `021_skiptrace_wallet.sql` (and the wallet's 017, 018, 020) |
| Tests (57 checks) | `scripts/ai/test-skiptrace.ts` |
`skip_trace_credits` (from 016) is no longer used; `scripts/launch/skiptrace-grant.cjs` therefore no longer applies (give an account money through the wallet instead).

## The money rules (all covered by tests)
1. **The vendor is called at most once per owner.** The result, hit or miss, is saved for 180 days and shared across accounts. An owner is identified by name plus mailing address (case, punctuation and spacing ignored), stored as a hash.
2. **Money is held before the vendor is called** (one hold per item, `lib/wallet`): the most the lookup can cost is set aside, a hit settles it into a charge, a miss or a vendor failure releases it. No funds, no lookup: the vendor is never called and nothing is saved.
3. **Contact data is charged only for a hit, and only the first time an account sees that owner.** Repeat views, misses and vendor failures cost nothing.
4. **The DNC check is charged only when phones came back and every phone has a yes/no answer** (unknown is not "safe": if the vendor leaves any out, the check is not charged and not claimed). It is charged again only after 30 days.
5. **DNC goes stale in 30 days.** A saved result's DNC status is only trusted for 30 days; after that the vendor re-checks it. (Callers generally must re-check about every 31 days: confirm with the lawyer.)
6. **DNC flags are never given away with a saved result:** an account that did not buy the check gets phones with no flags.
7. **Required mode never sells contact data without the check:** if the add-on is switched off, the vendor cannot do it, or the setting is damaged, lookups stop.
8. **Double clicks cannot double charge or double call the vendor** (a lock per owner, and the wallet row locks). Two lookups racing on money for one: one goes through, one is refused.
9. Admins get no free pass. The account must be allowed to see the parcel (county plan enforced by the same code the AI assistant uses): a parcel outside the plan returns 403 and costs nothing.
10. Phone numbers and emails are never written to logs. Only a short owner-key prefix and counts are.
11. If delivering a result succeeded but settling the charge fails twice, the result is still returned and the hold is kept for a person to look at (it never expires on its own).

## Turning it on (not yet: needs a vendor and decisions)
1. Choose a vendor and get a written quote for each item (`docs/vendor-call-checklist.md`). Implement `SkipTraceProvider` for it (declare `capabilities`) in a new file and add one line to `REGISTRY` in `providers.ts`.
2. Run `016_skip_trace.sql`, `017_wallet.sql`, `018_postcard_sizes.sql`, `020_wallet_holds.sql`, `021_skiptrace_wallet.sql` in the **production schema** (`app_prod`) and grant the production role the tables and sequences. None of them has been run there.
3. In `/admin/settings` set the price of `skip_trace` (and `skip_trace_dnc`), switch them on, and choose the DNC mode. Decide with the lawyer whether DNC is optional or required.
4. Set `SKIPTRACE_PROVIDER`, `SKIPTRACE_ENABLED=true` and (for customers) `WALLET_ENABLED=true` in Vercel production, redeploy, and test with your own account first. Top-ups are test-mode only until live wallet mode is switched on deliberately (see `docs/wallet.md`).
5. Run 20 to 50 real lookups against contacts you already know before anyone is charged.
6. Have a lawyer review the calling and privacy rules in `docs/skip-trace-vendors.md` (compliance section), and update the refund wording (used lookups are not refundable).

To switch it off again at any time: set `SKIPTRACE_ENABLED` to anything but `true`. The button disappears and the route answers 404 on the next request.

## Not built (on purpose, for now)
- The button in the map popup (only the results list card has it).
- Bulk lookup, export of contacts, calling or texting.
- A real vendor, and property data or permits as items (they need a vendor that offers them).
- Refund and dispute handling for wallet top-ups (see `docs/wallet.md`).
- A link to `/wallet` anywhere in the main navigation (the page exists; only the postcards page links to it).
