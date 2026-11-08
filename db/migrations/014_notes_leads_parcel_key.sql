-- Notes and leads key on parcel_key ('FL-<co_no>-<id>'), not parcelno. Both tables were empty at migration time (0 rows),
-- so there is nothing to backfill. The legacy parcel_id column stays (nullable) until the old parcels table is dropped.
ALTER TABLE user_parcel_notes ADD COLUMN IF NOT EXISTS parcel_key text;
ALTER TABLE leads             ADD COLUMN IF NOT EXISTS parcel_key text;
ALTER TABLE user_parcel_notes ALTER COLUMN parcel_id DROP NOT NULL;
ALTER TABLE leads             ALTER COLUMN parcel_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS user_parcel_notes_user_key_idx ON user_parcel_notes (user_id, parcel_key);
CREATE INDEX IF NOT EXISTS leads_user_key_idx ON leads (user_id, parcel_key);
