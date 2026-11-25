# Skip tracing vendors (owner phone / email lookup)

Researched 2026-11-25 from public web pages and search results only. **Nothing here was confirmed with a vendor, no accounts were created, and no money was spent.**
Prices on marketing pages change, conflict with each other, and are often "introductory". Treat every number below as a starting point for a sales conversation, not a quote.
Where a figure came from a competitor's blog or a third-party listing rather than the vendor's own page, it is marked *(third-party)*.

## What we need from a vendor

- A real API (not just a web upload), usable from a server route, one owner at a time.
- Pay per **hit** (a successful match), ideally nothing for a miss.
- No big monthly minimum while we have a handful of customers.
- Input we actually have: owner name and mailing address (and the property address). We do not have dates of birth or SSNs.
- Output we want: phones (with type: mobile / landline), emails, and a do-not-call flag.
- Terms that allow real-estate prospecting, and a written statement of permitted use.

## Comparison

| Vendor | API | Price per lookup (as published) | Minimums / commitment | Notes |
|---|---|---|---|---|
| **Tracerfy** | Yes. Every account has REST API access at the same price as the web app. | Most consistent figure: **$0.02 per successful skip trace**, misses free. Other pages quote higher tiers (enhanced ~$0.15 per lead; Lead Builder $0.10 per record) and a couple of outlier pages quote $0.009 to $0.01. | Pay as you go. No minimum for API use (the web upload has a minimum batch size). | Cheapest published price, built for investors and wholesalers. The conflicting prices on its own site mean we must get the real rate in writing. Smaller company: check data quality and uptime ourselves. |
| **BatchData** (BatchSkipTracing) | Yes. API plus bulk. | **No official per-record rate.** Its own blog gives $0.01 to $0.05 per matched record at volume (e.g. about $0.03 at 100,000 records a month). Help pages say pricing is by volume and product, ask sales. Another source quotes $0.50 to $2.00 for small single lookups *(third-party)*. | Public plans start around **$1,000 a month for 100,000 records** (Growth), with higher tiers. Pages also say "no contracts or minimums" for the API, which conflicts, so ask. | Best known in real estate, also has property data. The entry plan is far too big for a pilot unless pay-per-match with no commitment is available: ask for exactly that. |
| **Enformion** (formerly Endato) | Yes. Developer API: person search, email ID, address autocomplete. | **Not published.** Billed per "hit" or match, bulk discounts, quote only. | Unknown, quote based. | Mainstream data vendor with a developer focus, usually the strongest on compliance paperwork. Expect a permissible-use review before access is granted. Likely the right choice later if customers want a name brand. |
| **REISkip** | Not confirmed. Pages found describe a web upload product. | **$0.15 per match**, shown as "introductory" *(third-party blog)*. | 50-match minimum *(third-party)*, no subscription. | Cheap and simple for hand uploads, but we found no API documentation. Probably not usable for an in-app button. Ask whether an API exists. |
| **Skip Sherpa / Lead Sherpa** | Advertises a skip trace API, no rate limit, with a national DNC check. | Not found in the results. A help page mentions a $10 minimum charge. | Unknown. | The DNC check built in is attractive. Pricing needs a direct inquiry. |
| **BatchService** | Yes. | Contract pricing. | Annual or multi-year contracts *(third-party)*. | Wrong shape for a pilot (long commitment). |
| **Apify "skip trace" actors** | Via a marketplace. | About $0.12 per result or $14 per 1,000 *(listings)*. | None. | **Not recommended.** These are third-party scrapers of other websites. Provenance of the data and compliance are unclear, and a vendor with no accountable terms is a risk to the whole product. |

Not researched (no useful results): Melissa, People Data Labs, Whitepages Pro. Add them if the above fall through.

## Recommendation for the pilot

1. Use the **mock provider** (built in this branch, see docs/skip-trace.md) until a vendor is chosen. The feature flag stays off.
2. Ask **Tracerfy** and **BatchData** for a written quote on API access, pay per hit, no monthly minimum, and for their permitted-use terms for real-estate agents. If BatchData can only do the $1,000 a month plan, skip it for the pilot.
3. Ask **Enformion** for a quote if a brand-name vendor is needed for the broker's comfort. Expect more paperwork.
4. Plug the chosen vendor in behind `lib/skiptrace/provider.ts` (the interface is vendor neutral), then run 20 to 50 real lookups and compare phones against known contacts before charging anyone for this.

## Compliance notes (general, not legal advice: have a lawyer review before launch)

- **Permitted use.** Reputable vendors restrict skip trace data to specific purposes and forbid use for credit, insurance, employment, tenant screening or housing eligibility decisions (the FCRA). Our terms and the in-app button copy must not suggest such uses. Expect each vendor to ask what we use the data for and to require customers to agree to the same limits.
- **Calling and texting.** Phone numbers from a skip trace are not consent to be contacted. The federal Telephone Consumer Protection Act, the National Do Not Call Registry and state telemarketing laws (for example Florida's telephone solicitation act) apply to the agent making the calls, not to us. We should show the vendor's do-not-call flag when we have it and warn agents. Auto-dialing and texting carry the most risk: this is why texting stays out of scope.
- **Data accuracy.** Skip trace results are probabilistic. Show them as "possible" contacts, never as verified, and never imply the owner agreed to be contacted.
- **Privacy laws.** State privacy and data broker laws (several states, including California) give people rights to opt out and delete. Being a reseller or enricher of personal data may bring registration or notice duties depending on state and volume. Get advice before enabling this for customers outside Florida.
- **Storage.** We cache results so we never pay twice for the same owner. Treat the cache as personal data: keep it in our database only, delete it when an account is deleted if it is account-specific, and do not export it in bulk.
- **Cost control.** Every lookup costs real money. The per-account credit counter in this branch is a hard limit. Keep the flag off in production until a vendor is chosen and a price per credit is set.

## Sources (public pages found 2026-11-25)

- BatchData: batchdata.io/pricing, batchdata.io/blog/skip-tracing-cost-benchmarks, batchdata.io/plan/growth, help.batchdata.io (pricing article)
- Tracerfy: tracerfy.com, tracerfy.com/skip-tracing-api, tracerfy.com/property-skip-tracing
- Enformion (Endato): go.enformion.com, G2 listing for Enformion skip tracing (no price shown)
- REISkip: goliathdata.com/reiskip-pricing (competitor's description of REISkip pricing)
- Skip Sherpa: skipsherpa.com
- BatchService: datarade.ai listing
- Apify: apify.com skip trace actors
