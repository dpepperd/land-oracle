-- Wallet holds: reserve money before a paid service spends OUR money (a skip trace vendor call, a Lob postcard), then settle (keep it) or
-- release (give it back). Needs 017_wallet.sql first. Behind the same WALLET_ENABLED flag as the wallet. See docs/wallet.md.
-- NOT applied to production by anyone yet: run it in the app_prod schema after 017 and 018 and grant the production role the new table and sequence.
--
--   balance_cents  money the account owns (only top-ups, settled charges, refunds and adjustments change it, each with a ledger row)
--   held_cents     part of the balance reserved by open holds; spendable money = balance_cents - held_cents
--   wallet_holds   one row per hold: held -> settled (a 'charge' ledger row is written then) or released (no ledger row: the money never left)
-- The database itself refuses to hold more than the balance. A hold that is never settled or released (a crash) expires, and the money is
-- freed the next time that account reserves something.
ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS held_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_held_check;
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_held_check CHECK (held_cents >= 0 AND held_cents <= balance_cents);

CREATE TABLE IF NOT EXISTS wallet_holds (
  id              bigserial PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item            text    NOT NULL,                       -- what is being bought (skip_trace, postcard_4x6, ...)
  amount_cents    bigint  NOT NULL CHECK (amount_cents > 0),
  status          text    NOT NULL DEFAULT 'held' CHECK (status IN ('held','settled','released')),
  ref             text,
  description     text,
  idempotency_key text    NOT NULL UNIQUE,                -- one hold per postcard / lookup, however many times it is retried
  expires_at      timestamptz,                            -- NULL = never auto-released (needs a person to look)
  created_at      timestamptz NOT NULL DEFAULT now(),
  settled_cents   bigint,
  ledger_id       bigint REFERENCES wallet_ledger(id),
  closed_at       timestamptz,
  close_reason    text
);
CREATE INDEX IF NOT EXISTS wallet_holds_user_status_idx ON wallet_holds (user_id, status);
