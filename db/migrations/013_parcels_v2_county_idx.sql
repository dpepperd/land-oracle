-- parcels_current filters by county text; parcels_v2 only had co_no/key/geom indexes, so every county query seq-scanned 10.9M rows.
CREATE INDEX IF NOT EXISTS parcels_v2_county_idx ON parcels_v2 (county);
ANALYZE parcels_v2;
