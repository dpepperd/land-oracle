-- Parameterised per-county load.  $1 = county name (text), $2 = co_no (int).
-- Key source per row: parcel_id, unless it normalises to nothing, then parcelno.
-- Collisions on the separator-preserving key:
--   Duval                               -> merge group into one MultiPolygon (split tax parcels)
--   other, identical own_name+jv+dor_uc -> merge into one MultiPolygon
--   other, differing attributes         -> keep rows, suffix -d1/-d2.. , needs_review = true
-- No usable key -> quarantine = true, parcel_key NULL.
INSERT INTO parcels_v2
  (county, co_no, parcel_id, parcel_key, match_key, parcelno_legacy, geom,
   needs_review, quarantine, note, v1_gids)
WITH k0 AS (
  SELECT p.gid, p.parcel_id, p.parcelno,
         md5(concat_ws('|', coalesce(p.own_name,''), coalesce(p.jv::text,''), coalesce(p.dor_uc,''))) AS h,
         CASE WHEN normalize_parcel_id_sep(p.parcel_id, $1) IS NOT NULL THEN p.parcel_id ELSE p.parcelno END AS src
  FROM parcels p WHERE p.county = $1
), k1 AS (
  SELECT k0.gid, k0.parcel_id, k0.parcelno, k0.h,
         normalize_parcel_id_sep(k0.src, $1) AS sep,
         normalize_parcel_id(k0.src, $1)     AS strict
  FROM k0
), cls AS (
  SELECT k1.*,
         count(*)  OVER w AS gsize,
         (min(h) OVER w = max(h) OVER w) AS same_attrs,
         row_number() OVER (w ORDER BY gid) AS rn
  FROM k1
  WINDOW w AS (PARTITION BY sep)
), geo AS MATERIALIZED (
  SELECT x.gid, x.no_geom, x.was_invalid,
         CASE WHEN x.no_geom THEN NULL
              WHEN NOT x.was_invalid THEN ST_Multi(x.geom)
              ELSE (SELECT CASE WHEN ST_IsEmpty(f) THEN NULL ELSE f END
                    FROM (SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(x.geom), 3)) AS f) s)
         END AS g2
  FROM (SELECT p.gid, p.geom,
               (p.geom IS NULL OR ST_IsEmpty(p.geom)) AS no_geom,
               (p.geom IS NOT NULL AND NOT ST_IsEmpty(p.geom) AND NOT ST_IsValid(p.geom)) AS was_invalid
        FROM parcels p WHERE p.county = $1) x
), r AS (
  -- quarantined: no usable key
  SELECT c.parcel_id, NULL::text AS pk, NULL::text AS mk, c.parcelno, ge.g2 AS geom,
         true AS nr, true AS q,
         concat_ws(';', 'no_key',
                   CASE WHEN ge.no_geom THEN 'empty_geom' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NOT NULL THEN 'invalid_geom_fixed' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NULL THEN 'invalid_geom_unfixable' END) AS note,
         ARRAY[c.gid] AS gids
  FROM cls c JOIN geo ge USING (gid) WHERE c.sep IS NULL
  UNION ALL
  -- unique key
  SELECT c.parcel_id, ($2::int)::text || '-' || c.sep, c.strict, c.parcelno, ge.g2,
         (ge.no_geom OR (ge.was_invalid AND ge.g2 IS NULL)), false,
         NULLIF(concat_ws(';',
                   CASE WHEN ge.no_geom THEN 'empty_geom' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NOT NULL THEN 'invalid_geom_fixed' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NULL THEN 'invalid_geom_unfixable' END), ''),
         ARRAY[c.gid]
  FROM cls c JOIN geo ge USING (gid) WHERE c.sep IS NOT NULL AND c.gsize = 1
  UNION ALL
  -- collision merged into one MultiPolygon
  SELECT min(c.parcel_id), ($2::int)::text || '-' || c.sep, min(c.strict), min(c.parcelno),
         ST_Multi(ST_CollectionExtract(ST_Union(ge.g2), 3)),
         bool_or(ge.no_geom OR (ge.was_invalid AND ge.g2 IS NULL)), false,
         concat_ws(';',
                   CASE WHEN $1 = 'Duval' THEN 'duval_split_merged:' ELSE 'merged_identical_attrs:' END || count(*),
                   CASE WHEN bool_or(ge.was_invalid AND ge.g2 IS NOT NULL) THEN 'invalid_geom_fixed' END),
         array_agg(c.gid ORDER BY c.gid)
  FROM cls c JOIN geo ge USING (gid)
  WHERE c.sep IS NOT NULL AND c.gsize > 1 AND ($1 = 'Duval' OR c.same_attrs)
  GROUP BY c.sep
  UNION ALL
  -- collision, differing attributes: suffix and flag
  SELECT c.parcel_id, ($2::int)::text || '-' || c.sep || '-d' || c.rn, c.strict, c.parcelno, ge.g2,
         true, false,
         concat_ws(';', 'collision_suffixed:' || c.gsize,
                   CASE WHEN ge.no_geom THEN 'empty_geom' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NOT NULL THEN 'invalid_geom_fixed' END,
                   CASE WHEN ge.was_invalid AND ge.g2 IS NULL THEN 'invalid_geom_unfixable' END),
         ARRAY[c.gid]
  FROM cls c JOIN geo ge USING (gid)
  WHERE c.sep IS NOT NULL AND c.gsize > 1 AND NOT ($1 = 'Duval' OR c.same_attrs)
)
SELECT $1, $2::smallint, parcel_id, pk, mk, parcelno, geom, nr, q, note, gids FROM r;
