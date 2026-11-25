# Skip tracing (owner phone / email lookup): how it works

Status: **built, tested with a fake vendor, OFF.** No real vendor is connected, nothing is applied to production, and no customer can see the button.
Written overnight 2026-11-25 on branch `feature/skip-trace-scaffold`. Vendor options and prices are in `docs/skip-trace-vendors.md`.

## What a user sees (only when the flag is on)
A **Get owner contact** button on each Florida parcel card (hidden for other states and whenever the flag is off). Clicking it shows possible phone numbers (with type and a Do Not Call mark when the vendor gives one) and emails, with a reminder that they are unverified and the Do Not Call list must be checked. The button shows the credits left.

## The pieces
| Piece | File |
|---|---|
| The on/off flag, owner key, credits, caching, charging | `lib/skiptrace/service.ts` |
| Vendor interface (plug a vendor in here) | `lib/skiptrace/types.ts` (`SkipTraceProvider`) |
| Which vendor is used | `lib/skiptrace/providers.ts` (`SKIPTRACE_PROVIDER`) |
| Fake vendor for tests and local work | `lib/skiptrace/mock.ts` (refused in production) |
| API: `GET /api/skiptrace` (enabled? credits?), `POST /api/skiptrace {parcel_key}` | `app/api/skiptrace/route.ts` |
| The button | `components/dashboard/OwnerContact.tsx`, used in `ParcelCard.tsx` |
| Tables | `db/migrations/016_skip_trace.sql` |
| Give an account credits | `scripts/launch/skiptrace-grant.cjs` |
| Tests (29 checks) | `scripts/ai/test-skiptrace.ts` |

## The money rules (all covered by tests)
1. **The vendor is called at most once per owner.** The result, hit or miss, is saved for 180 days and shared across accounts. An owner is identified by name plus mailing address (case, punctuation and spacing ignored), stored as a hash.
2. **An account pays 1 credit only for a hit, and only the first time it sees that owner.** Repeat views, misses and vendor failures cost nothing.
3. **No credits, no lookup.** With 0 credits the vendor is never called and nothing is saved. A saved miss, or a result the account already paid for, can still be read.
4. **Double clicks cannot double charge or double call the vendor.** (A lock per owner and a lock on the credit row.)
5. **Admins get no free pass.** Every lookup costs real money.
6. The account must be allowed to see the parcel: the county plan is enforced by the same code the AI assistant uses. A parcel outside the plan returns 403 and costs nothing.
7. Phone numbers and emails are never written to logs. Only a short owner-key prefix and counts are.

## Turning it on (not yet: needs a vendor and decisions)
1. Choose a vendor and get a written quote (`docs/skip-trace-vendors.md`). Implement `SkipTraceProvider` for it in a new file and add one line to `REGISTRY` in `providers.ts`.
2. Run `db/migrations/016_skip_trace.sql` in the **production schema** (`app_prod`) and grant the production role access to `skip_trace_credits`, `skip_trace_cache`, `skip_trace_lookups` (and the sequence). The migration has not been run there.
3. Decide how credits are sold (a plan allowance, packs, or manual grants at first). Today credits are granted by hand: `node scripts/launch/skiptrace-grant.cjs <email> <amount> app_prod`. Update the refund policy: the page already says used lookup credits are non-refundable.
4. Set `SKIPTRACE_PROVIDER` to the new vendor id and `SKIPTRACE_ENABLED=true` in Vercel (production), redeploy, and test with your own account first.
5. Run 20 to 50 real lookups against contacts you already know before anyone is charged.
6. Have a lawyer review the calling and privacy rules in `docs/skip-trace-vendors.md` (compliance section).

To switch it off again at any time: set `SKIPTRACE_ENABLED` to anything but `true`. The button disappears and the route answers 404 on the next request.

## Not built (on purpose)
- Selling or topping up credits (no Stripe product yet).
- The button in the map popup (only the results list card has it).
- Bulk lookup, export of contacts, calling or texting.
- A real vendor.
