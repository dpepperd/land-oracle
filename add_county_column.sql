-- Add county column if missing
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS county VARCHAR(100);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_parcels_county ON parcels(county);

-- Backfill (Temporary fix for testing - implies 'Baker' if null, or we can use existing data logic if available)
-- Since we are working on Baker data, we will set it to Baker.
UPDATE parcels SET county = 'Baker' WHERE county IS NULL;

-- Verify
SELECT county, COUNT(*) FROM parcels GROUP BY county;
