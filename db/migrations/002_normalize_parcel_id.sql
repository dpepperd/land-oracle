-- Parcel-ID normalizers. Both strip a leading "<County>-" prefix (e.g. "Pasco-")
-- and upper-case. Neither removes leading zeros.
--
--   normalize_parcel_id      STRICT: drops every non-alphanumeric. Used for match_key
--                            (joining to DOR NAL/SDF files). NOT injective.
--   normalize_parcel_id_sep  SEPARATOR-PRESERVING: collapses runs of space/dot/dash to
--                            one '-', keeps other characters (+ * ( ) _ < >).
--                            Used for parcel_key (identity).
-- Both return NULL when nothing is left.
CREATE OR REPLACE FUNCTION normalize_parcel_id(raw text, county text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT NULLIF(upper(regexp_replace(
           regexp_replace(btrim(raw),
             '^\s*' || regexp_replace(coalesce(county, ''), '\s+', '[ ]*', 'g') || '\s*-+\s*', '', 'i'),
           '[^A-Za-z0-9]', '', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION normalize_parcel_id_sep(raw text, county text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT NULLIF(btrim(upper(regexp_replace(
           regexp_replace(btrim(raw),
             '^\s*' || regexp_replace(coalesce(county, ''), '\s+', '[ ]*', 'g') || '\s*-+\s*', '', 'i'),
           '[\s.\-]+', '-', 'g')), '-'), '')
$$;
