-- Skip tracing (owner phone / email lookup), behind SKIPTRACE_ENABLED (off by default). See docs/skip-trace.md.
-- NOT applied to production by anyone yet. Before turning the flag on in production, run this in the app_prod schema
-- (SET search_path = app_prod, public; then this file) and grant the production role access to the three tables.

-- Credits per account. balance = lookups left, used = lookups paid for so far. New accounts have no row (= 0 credits).
CREATE TABLE IF NOT EXISTS skip_trace_credits (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  used    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per owner (name + mailing address, normalized, hashed). Shared across accounts so we never pay a vendor twice for the same owner.
-- Misses (matched = false) are cached too, so a miss is not paid for again either. Holds personal data: never export it in bulk.
CREATE TABLE IF NOT EXISTS skip_trace_cache (
  owner_key  text PRIMARY KEY,
  provider   text NOT NULL,
  matched    boolean NOT NULL,
  phones     jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails     jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Ledger: one row per lookup request that reached the service. charged = credits taken (0 or 1). Used to charge an account only once per owner.
CREATE TABLE IF NOT EXISTS skip_trace_lookups (
  id         bigserial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_key  text NOT NULL,
  parcel_key text,
  provider   text NOT NULL,
  matched    boolean NOT NULL,
  cached     boolean NOT NULL,
  charged    integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skip_trace_lookups_user_owner_idx ON skip_trace_lookups (user_id, owner_key);
