-- Postcard sizes, designs and images. Idempotent. Like 017, NOT applied to production by anyone yet (run it in app_prod after 017, with grants).

-- 1. Prices used to be {"postcard": 115, ...}. Now every item is {"cents": n, "enabled": bool} and postcards are priced per size.
--    Only rewrites a row still in the old shape; keeps any value an admin already set for the 4x6 card.
UPDATE app_settings SET value = jsonb_build_object(
    'postcard_4x6',  jsonb_build_object('cents', COALESCE((value->>'postcard')::int, 115), 'enabled', true),
    'postcard_6x9',  jsonb_build_object('cents', 130, 'enabled', true),
    'postcard_6x11', jsonb_build_object('cents', 155, 'enabled', true),
    'skip_trace',    jsonb_build_object('cents', COALESCE((value->>'skip_trace')::int, 15), 'enabled', false),
    'property_data', jsonb_build_object('cents', COALESCE((value->>'property_data')::int, 20), 'enabled', false),
    'permit',        jsonb_build_object('cents', COALESCE((value->>'permit')::int, 20), 'enabled', false),
    'monitor_alert', jsonb_build_object('cents', COALESCE((value->>'monitor_alert')::int, 75), 'enabled', false))
WHERE key = 'wallet_prices' AND jsonb_typeof(value->'postcard') = 'number';

-- 2. What was sent: size, design, mail class, and the text fields (never the images).
ALTER TABLE postcards ADD COLUMN IF NOT EXISTS size      text NOT NULL DEFAULT '4x6' CHECK (size IN ('4x6','6x9','6x11'));
ALTER TABLE postcards ADD COLUMN IF NOT EXISTS design    text;
ALTER TABLE postcards ADD COLUMN IF NOT EXISTS mail_type text NOT NULL DEFAULT 'usps_first_class';
ALTER TABLE postcards ADD COLUMN IF NOT EXISTS spec      jsonb;

-- 3. Uploaded logos and photos. Resized and stripped of metadata (including GPS) before saving; owned by one account.
CREATE TABLE IF NOT EXISTS postcard_assets (
  id         bigserial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text    NOT NULL CHECK (kind IN ('logo','photo')),
  mime       text    NOT NULL CHECK (mime IN ('image/png','image/jpeg')),
  width      integer NOT NULL,
  height     integer NOT NULL,
  bytes      bytea   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postcard_assets_user_idx ON postcard_assets (user_id, id DESC);
