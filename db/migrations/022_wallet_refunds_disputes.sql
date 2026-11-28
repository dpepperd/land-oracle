-- Wallet: refunds and disputes (chargebacks) on top-ups, a freeze for accounts with an open dispute, and a list of things a person must look at.
-- Needs 017_wallet.sql and 020_wallet_holds.sql first. See docs/wallet.md. NOT applied to production by anyone yet: run it in the app_prod schema
-- after the others and grant the production role the new tables and sequences.
--
--   wallet_accounts.frozen_at / frozen_reason   a frozen wallet cannot start new spending (holds, charges); it can still be topped up by webhook, settle or release
--                                               holds already open, and be adjusted by an admin
--   wallet_topups     one row per credited top-up, keyed by the Stripe payment, so a refund or dispute can find the money it is about
--   wallet_disputes   one row per Stripe dispute: how much was taken back from the wallet when it opened, how much could not be, and how it ended
--   wallet_incidents  what a person must look at (a refund or dispute we could not fully take back, an open dispute needing evidence, a lost dispute)
ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS frozen_at     timestamptz;
ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS frozen_reason text;

CREATE TABLE IF NOT EXISTS wallet_topups (
  id             bigserial PRIMARY KEY,
  user_id        integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_intent text    NOT NULL UNIQUE,
  session_id     text    NOT NULL UNIQUE,
  amount_cents   bigint  NOT NULL CHECK (amount_cents > 0),
  refunded_cents bigint  NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),   -- refunds already applied to the wallet (a running total)
  livemode       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_topups_user_idx ON wallet_topups (user_id);

CREATE TABLE IF NOT EXISTS wallet_disputes (
  id                bigserial PRIMARY KEY,
  user_id           integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_dispute_id text    NOT NULL UNIQUE,
  payment_intent    text,
  amount_cents      bigint  NOT NULL CHECK (amount_cents > 0),
  reason            text,
  status            text    NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','inquiry','inquiry_closed')),
  debited_cents     bigint  NOT NULL DEFAULT 0 CHECK (debited_cents >= 0),   -- taken back from the wallet when the dispute opened
  shortfall_cents   bigint  NOT NULL DEFAULT 0 CHECK (shortfall_cents >= 0), -- could not be taken back (already spent, or set aside for a service)
  reinstated_cents  bigint  NOT NULL DEFAULT 0 CHECK (reinstated_cents >= 0),-- given back to the wallet when we won
  created_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz
);
CREATE INDEX IF NOT EXISTS wallet_disputes_user_status_idx ON wallet_disputes (user_id, status);

CREATE TABLE IF NOT EXISTS wallet_incidents (
  id           bigserial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text    NOT NULL CHECK (kind IN ('refund_shortfall','dispute_open','dispute_shortfall','dispute_lost','manual')),
  amount_cents bigint  NOT NULL DEFAULT 0,
  ref          text,                                   -- Stripe charge or dispute id
  note         text,
  status       text    NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolution   text
);
CREATE INDEX IF NOT EXISTS wallet_incidents_status_idx ON wallet_incidents (status, id);
CREATE INDEX IF NOT EXISTS wallet_incidents_user_idx ON wallet_incidents (user_id);
