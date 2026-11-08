# AI Analysis Assistant — Spec (Option A: in-portal, Anthropic API)

- Runs inside the Land Oracle portal using our ANTHROPIC_API_KEY. Users never need a Claude account.
- Tools only, no free-form SQL. Each tool enforces Clerk auth + county entitlements server-side:
  - searchParcels(filters): county, use code, acreage, value range, absentee owner, years since last sale, flood zone. Max 50 rows to the model + total count; full lists via export.
  - getParcel(parcel_key)
  - getComps(parcel_key, radius, months) from DOR SDF qualified sales
  - parcelContext(parcel_key): flood zone, highway proximity
- /api/chat on Node runtime, @anthropic-ai/sdk tool use + streaming, model from ANTHROPIC_MODEL env, max 6 tool iterations.
- System prompt: FL real estate analyst for licensed agents; property facts only, never filter/rank by owner demographics (fair housing); cite parcel IDs; end with verify-before-transacting note.
- Usage table ai_usage(user_id, month, tokens, requests); per-tier monthly caps; friendly 429 over cap; admins exempt. Anthropic console spend limit as backstop.
- Tiers: Pro and Statewide only (shown "Coming soon" until AI_ASSISTANT_ENABLED=true).
- UI: chat panel + "Analyze with AI" button on parcel popup (prefills parcel_key); parcel IDs in answers link to the map.
- Reads only from parcels_current view.
- Existing work: branch feat/ai-assistant (e09cce2), unmerged.
- Test: 5 real realtor questions (picked with Tat) against Clay County; report tool calls, tokens, cost per question.
