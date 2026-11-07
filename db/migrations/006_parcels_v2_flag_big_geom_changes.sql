-- Flag ST_MakeValid fixes that changed a parcel's area by more than 5% so a human looks at them.
-- Idempotent. Touches parcels_v2 only.
UPDATE parcels_v2 v
SET needs_review = true,
    note = concat_ws(';', v.note, 'area_change_gt5pct')
FROM parcels p
WHERE cardinality(v.v1_gids) = 1
  AND p.gid = v.v1_gids[1]
  AND v.note LIKE '%invalid_geom_fixed%'
  AND v.geom IS NOT NULL
  AND coalesce(v.note, '') NOT LIKE '%area_change_gt5pct%'
  AND abs(ST_Area(v.geom) - ST_Area(p.geom)) / NULLIF(ST_Area(p.geom), 0) > 0.05;
