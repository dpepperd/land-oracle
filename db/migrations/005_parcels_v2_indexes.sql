-- Run after all counties are loaded.
CREATE UNIQUE INDEX IF NOT EXISTS parcels_v2_parcel_key_uq ON parcels_v2 (parcel_key) WHERE NOT quarantine;
CREATE INDEX IF NOT EXISTS parcels_v2_match_key_idx ON parcels_v2 (match_key, co_no);
CREATE INDEX IF NOT EXISTS parcels_v2_co_no_idx ON parcels_v2 (co_no);
CREATE INDEX IF NOT EXISTS parcels_v2_geom_gix ON parcels_v2 USING gist (geom);
