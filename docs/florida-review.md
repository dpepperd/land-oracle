# Florida code review (overnight, 2026-11-25)

Scope: the Florida paths a broker would use: search, export, parcel detail, leads, notes, choosing counties, checkout, admin actions. Read the code, then proved each problem on the **development** database with the real route handlers (stubbed sign-in). Production and `app_prod` were not touched (and I was stopped from reading `app_prod` when I tried to, which was correct).
Branch: `fix/fl-review`. Tests: `scripts/ai/test-fl-review.ts` (22 checks) and `scripts/ai/test-csv.ts`.

## Fixed in this branch

| # | Problem | How I proved it | Fix |
|---|---|---|---|
| 1 | **A 1-character parcel ID or address search loads the database.** The text search builds a list of every match first. "1" in Duval matched about 780,000 rows. A lone `%` matched everything (the wildcard was not escaped). | Real handler, Duval: `1` took **10.3 s**, `%` 3.6 s, address `a` 3.0 s, versus 1.5 s for a normal 4-character search. | Text search needs at least 3 characters (a plain message otherwise). `%`, `_` and `\` typed by the user are taken literally. Same rule in the search, the export and the Texas/NC pilot search (`lib/searchText.ts`). |
| 2 | **Spreadsheet formula injection in CSV exports.** A text value starting with `=`, `+`, `-` or `@` (an owner name, an address) would run as a formula when a customer opens the file in Excel. Two separate CSV writers, neither protected. | Reading the code. | One shared writer (`lib/csv.ts`) puts a leading apostrophe on such text. Numbers and dates are written exactly as before. Used by the parcel export and the AI export. |
| 3 | **Marking a lead twice inserted two rows, and then the parcel showed twice in results** (the search joined on leads). No unique rule in the table. | Inserted a duplicate lead on dev: parcel appeared twice. | Creating a lead is now idempotent (returns the existing one). The search, the Texas/NC search and the AI parcel list no longer join: they ask "does a lead exist" so duplicates can never multiply rows, even ones that already exist. |
| 4 | **Choosing counties could be raced past the plan's limit.** Count-then-insert with no lock: three simultaneous requests on a 1-county plan saved 2 counties. (Access checks ignore the extras, so no extra access was granted, but it is wrong.) Also accepted invented county names that used up a slot. | Real handler on dev with the old code: `rows 2, statuses 200,200,403`. | The user row is locked while picking, so requests take turns. Only real Florida counties are accepted (every county the screen offers still passes: checked). |
| 5 | **Internal error text was sent to the browser.** The search returned the raw error message on a 500 (for example "permission denied for schema dor"), and the county picker returned `"Internal Error: " + message`. | Reading the code. | Plain message to the user; detail stays in the server log. |
| 6 | **A drawn circle with no centre crashed with a 500** (and exposed the internal message). | Real handler. | A clear 400 "The drawn area is not valid" in the Florida search, the export and the pilot search. |
| 7 | **Notes had no validation.** No length limit (unbounded storage), a missing note could crash, broken JSON crashed. The validation schema for notes existed but was not used. | Reading the code and the tests. | Parcel key and a note of 1 to 5,000 characters, otherwise a 400. The note box on screen is capped at 5,000 characters so a long note can never fail silently. |

## Not changed: needs a decision from you

1. **The map popup shows a fake "Contact Info" box.** It has Phone and Email lines that nothing fills in: paying users see "N/A", free users see a blurred placeholder phone number `(555) 000-0000` with an "Upgrade to view" prompt. There is no owner phone or email data anywhere in the product, so upgrading would show nothing. In front of a broker this looks broken, and the blurred number implies data that does not exist. Suggested: hide the box, and show the owner contact button there only once skip tracing is real. Not changed here because the skip-trace branch edits the same lines (merge that branch first, then do this).
2. **Export limits can be sidestepped through search.** A search returns up to 5,000 rows per request with owner names and mailing addresses, and there is no limit on how many searches a plan can run. So the Scout plan's 1,000 exported rows a month is a limit on the CSV button only. The new daily search count records searches but not rows. Options: record rows returned per account and cap per day per plan, or accept it (anyone can already click county sites). This is a product decision.
3. **Leads have no unique rule in the database** (user + parcel). The code now handles it, but a unique index in `app_prod` (after removing any existing duplicates) would make it permanent. I could not check production for duplicates (not allowed overnight), so look before adding the index.
4. **Drawn polygons have no size limit.** A very large shape (thousands of points) is accepted. Suggested: cap at a few thousand points. Low risk (signed-in users only).
5. **Leads and notes accept any parcel key**, including parcels in counties the plan does not cover. Harmless (they only store a key against the user's own account) but untidy.
6. **Admins see each other's notes** on a parcel. That is by design; just be aware.

## Looked at and fine
- Checkout: prices come from Stripe lookup keys, input is validated, an existing subscriber cannot start a second one, nothing sensitive in errors.
- Admin actions and the admin layout are all behind the admin check.
- County plan limits in the search (a drawn box over a county not on the plan returns nothing).
- Export limit accounting and the 5,000-row cap per export.
- The CSV export format for numbers and dates is unchanged.
