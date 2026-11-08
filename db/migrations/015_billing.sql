-- Billing state on users + monthly export usage + webhook idempotency.
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_interval text;                 -- 'month' | 'year'
ALTER TABLE users ADD COLUMN IF NOT EXISTS county_allowance integer NOT NULL DEFAULT 0;   -- base + add-on counties (statewide: 67)
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_county_repick boolean NOT NULL DEFAULT false;  -- set on downgrade
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_idx ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_stripe_sub_idx ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Rows exported per user per calendar month (UTC). Scout is capped at 1,000.
CREATE TABLE IF NOT EXISTS export_usage (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month   date    NOT NULL,
  rows    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- Processed Stripe event ids (webhooks are delivered at least once).
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
