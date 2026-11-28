-- Skip trace on the wallet (see docs/skip-trace.md and docs/wallet.md). Needs 016_skip_trace.sql and 017/018/020 (wallet) first.
-- NOT applied to production by anyone yet: run it in the app_prod schema after the others.
-- Lookups are now paid from the wallet (a hold per priced item, settled on a hit), not from skip_trace_credits (that table is no longer used).
--   skip_trace_cache.dnc_checked_at   when the Do Not Call status on the saved phones was checked (NULL = never). DNC goes stale fast, so it has its own, shorter, life.
--   skip_trace_lookups.paid_*_cents   what this account paid for this owner (contact data, Do Not Call check), in cents
ALTER TABLE skip_trace_cache   ADD COLUMN IF NOT EXISTS dnc_checked_at timestamptz;
ALTER TABLE skip_trace_lookups ADD COLUMN IF NOT EXISTS paid_contact_cents integer NOT NULL DEFAULT 0;
ALTER TABLE skip_trace_lookups ADD COLUMN IF NOT EXISTS paid_dnc_cents     integer NOT NULL DEFAULT 0;
-- Lookups made before this migration paid one credit: count them as paid so the same owner is not charged twice. (The cents are unknown: 1 marks "paid".)
UPDATE skip_trace_lookups SET paid_contact_cents = 1 WHERE charged > 0 AND paid_contact_cents = 0;
