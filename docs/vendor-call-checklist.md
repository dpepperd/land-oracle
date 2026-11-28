# Vendor call checklist: skip trace and data vendors

For the BatchData call (Monday 2026-11-30, 11:00) and the same questions to Tracerfy and any later vendor. Written 2026-11-28.

## What we are trying to learn
We sell prepaid wallet credits (see `docs/wallet.md`), so we only pay the vendor per use, never a big monthly fee before we have customers. Each thing a customer can buy is a separate priced item (contact data, DNC check, property data, permits, ...). We can only offer an item if the vendor lets us use it this way, so the goal of the call is to find out **which items we can offer and what each costs us**.

**Dealbreakers (any one of these and the vendor does not fit the launch):**
1. A monthly subscription or minimum spend we must pay before customers pay us.
2. No permission to resell the results to our customers.
3. No permission to store the results (we cache them so the vendor is called once per owner).

## Questions, in order

### A. How we buy
1. Can we pay per successful match, with **no monthly minimum**? What is the price per match at small volumes (a few hundred a month)?
2. Prepaid credits or invoiced after use? Is there a minimum top-up?
3. Are misses (no match) free? Are refunds or credits given for wrong or disconnected numbers?
4. Is there an API? Any rate limit? What is the uptime promise?
5. Do prices change by volume, and where are the tiers?

### B. Which items we can offer (get a price for each)
| Item | Offered through the API? | Our cost per use | Notes |
|---|---|---|---|
| Contact data (phones, emails) | | | |
| DNC check, bundled with contact data | | | |
| DNC check, separate purchase | | | Can we buy it for numbers we already have? |
| Property data (which fields? sale history and prices, mortgage, equity, ownership) | | | Does it include **Texas sale prices**? We do not know. |
| Permits | | | |
| Owner mailing-address check or update | | | |
| Anything else useful for land (tax status, liens, foreclosure flags) | | | |

### C. DNC (Do Not Call) in detail
1. Which lists does the check cover: national registry, state lists, a litigator or known-complainant list?
2. How fresh is it, and how often must a result be re-checked? (Callers generally have to re-check the registry about every 31 days, so a stored DNC result goes stale much faster than a phone number. Ask the vendor and confirm with a lawyer.)
3. Can the DNC flag be returned with each phone number, so we can show it next to the number?
4. Is the DNC check required, or can we sell contact data without it? (We can make it mandatory in our product either way.)

### D. Coverage and quality
1. Do they cover **Florida, North Carolina and Texas** owners, including owners with out-of-state mailing addresses and owners that are LLCs or trusts?
2. Typical match rate for land owners (not just homeowners), and for out-of-state owners.
3. How old is the data, and how is it refreshed?
4. Can we try 100 to 200 records free or cheaply before committing?

### E. Rights and rules (these decide whether we can sell it at all)
1. **Resale:** may we sell the results to our subscribers (real-estate agents and brokers)? In writing.
2. **Storage:** may we keep results in our database and show them again later? For how long?
3. **Sharing between accounts:** may one customer's paid lookup be reused for another customer (we pay the vendor once, each customer pays us once)?
4. **Permitted use:** which uses are allowed for real-estate prospecting? Any banned uses (employment, credit, insurance)?
5. **Customer vetting:** do they require us to check our customers (a broker license, a stated purpose) before they can use the data? Any audit rights?
6. Are there rules about calling, texting and emailing that we must pass on to customers?

### F. Practical
1. Contract: term, cancellation, price-change notice, and what happens to stored data if we leave.
2. Who is our contact for support and for disputes?
3. Can we get a written quote with prices for each item above?

## After the call
- Fill in the table in B and save it in `docs/skip-trace-vendors.md` with the date.
- If every dealbreaker is clear: ask for sandbox or test access and build the adapter (`lib/skiptrace/providers.ts`), then run 20 to 50 real lookups on contacts we already know before any customer is charged.
- Set our price for each item in `/admin/settings` once the cost is known (the wallet keeps price and on/off switch per item, so this needs no code).
- Decide whether DNC is optional or mandatory in the product, with the lawyer.
