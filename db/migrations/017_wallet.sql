-- Credit wallet and postcards. Behind WALLET_ENABLED (admins only until opened). See docs/wallet.md.
-- NOT applied to production by anyone yet. Before turning this on in production, run this file in the app_prod schema
-- (SET search_path = app_prod, public; then this file) and grant the production role access to the tables and sequences.
-- All money is stored as whole cents (integers), never floats.

-- One row per account that has ever held money. A missing row means a balance of 0.
CREATE TABLE IF NOT EXISTS wallet_accounts (
  user_id       integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_cents bigint  NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),   -- the database itself refuses a negative balance
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Every top-up and every charge. amount_cents is signed: positive = money in, negative = money out. The app never updates or deletes these rows.
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id                  bigserial PRIMARY KEY,
  user_id             integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                text    NOT NULL CHECK (kind IN ('topup','charge','refund','adjustment')),
  item                text,                       -- what was bought (postcard, skip_trace, ...); null for top-ups
  amount_cents        bigint  NOT NULL CHECK (amount_cents <> 0),
  balance_after_cents bigint  NOT NULL CHECK (balance_after_cents >= 0),
  ref                 text,                       -- Stripe session id, Lob postcard id, ...
  idempotency_key     text    UNIQUE,             -- a Stripe event or a postcard can never be credited or charged twice
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON wallet_ledger (user_id, id DESC);

-- Admin-editable settings (prices, return address). value is JSON.
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id) ON DELETE SET NULL
);

-- Starting prices, in cents. This is data, not code: change it in /admin/settings. Existing values are never overwritten.
INSERT INTO app_settings (key, value) VALUES
  ('wallet_prices', '{"skip_trace":15,"postcard":115,"property_data":20,"permit":20,"monitor_alert":75}'::jsonb),
  ('postcard_return_address', '{"name":"","address_line1":"","address_line2":"","city":"","state":"","zip":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- One row per postcard request. Holds the recipient's mailing address (personal data): never export it in bulk.
CREATE TABLE IF NOT EXISTS postcards (
  id            bigserial PRIMARY KEY,
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcel_key    text,
  to_name       text NOT NULL,
  to_line1      text NOT NULL,
  to_line2      text,
  to_city       text NOT NULL,
  to_state      text NOT NULL,
  to_zip        text NOT NULL,
  message       text NOT NULL,
  status        text NOT NULL CHECK (status IN ('sending','sent','rejected_address','failed','sent_unpaid_cancel_requested')),
  reason        text,                     -- why it was refused or failed, in plain words
  lob_id        text,
  cost_cents    bigint,                   -- what was charged (null until charged)
  ledger_id     bigint REFERENCES wallet_ledger(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postcards_user_idx ON postcards (user_id, id DESC);
