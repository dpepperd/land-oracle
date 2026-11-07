-- parcels_v2: keys + geometry only. Attributes are reloaded in a later phase.
-- Built alongside parcels (v1); nothing is swapped, dropped or altered in v1.
CREATE TABLE IF NOT EXISTS parcels_v2 (
  id              bigserial PRIMARY KEY,
  county          text      NOT NULL,
  co_no           smallint  NOT NULL REFERENCES county_codes (co_no),
  parcel_id       text,                         -- as stored in v1 (DOR id); NULL for Clay/Duval
  parcel_key      text,                         -- '<co_no>-<separator-preserving id>[-dN]'; NULL if quarantined
  match_key       text,                         -- strict id for joining to DOR files (not unique)
  parcelno_legacy text,                         -- v1 parcelno (Leon: repaired from shapefile)
  geom            geometry(MultiPolygon, 4326), -- ST_MakeValid'd; NULL if v1 geometry was empty/unfixable
  needs_review    boolean   NOT NULL DEFAULT false,
  quarantine      boolean   NOT NULL DEFAULT false,
  note            text,                         -- ';'-separated build outcomes
  v1_gids         integer[] NOT NULL            -- parcels.gid values folded into this row
);
