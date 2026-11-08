-- Promote DOR staging tables to schema dor (rename only, no copy) and add the small helpers parcels_current needs.
CREATE SCHEMA IF NOT EXISTS dor;
DO $$ BEGIN
  IF to_regclass('staging.nal_2026') IS NOT NULL THEN ALTER TABLE staging.nal_2026 SET SCHEMA dor; END IF;
  IF to_regclass('staging.sdf_2026') IS NOT NULL THEN ALTER TABLE staging.sdf_2026 SET SCHEMA dor; END IF;
END $$;

-- Volusia: parcels_v2 keys on the county ALT_KEY, so NAL joins through alt_key (partial index, ~15 MB).
CREATE INDEX IF NOT EXISTS nal_2026_volusia_alt_idx ON dor.nal_2026 (upper(regexp_replace(alt_key, '[^A-Za-z0-9]', '', 'g'))) WHERE co_no = 74;

-- Strict-key duplicates inside NAL (Marion, Brevard: ids differing only by separator). Keep each row's separator-preserving
-- key so the join can pick the right one. Tiny table.
CREATE TABLE IF NOT EXISTS dor.nal_dupes AS
SELECT n.co_no, n.seq_no, normalize_parcel_id_sep(n.parcel_id, cc.name) AS sep_key
  FROM dor.nal_2026 n JOIN county_codes cc USING (co_no)
 WHERE (n.co_no, n.match_key) IN (SELECT co_no, match_key FROM dor.nal_2026 GROUP BY 1, 2 HAVING count(*) > 1);
CREATE UNIQUE INDEX IF NOT EXISTS nal_dupes_pk ON dor.nal_dupes (co_no, seq_no);

-- Last 3 qualified (DOR codes 01/02, price > $100) sales per parcel; small precomputed table. REFRESH after reloading SDF.
-- join_key matches parcels_v2.match_key (Volusia goes through NAL ALT_KEY).
DROP MATERIALIZED VIEW IF EXISTS dor.sales_last3;
CREATE MATERIALIZED VIEW dor.sales_last3 AS
WITH q AS (
  SELECT s.co_no, s.match_key, make_date(s.sale_yr::int, s.sale_mo::int, 1) AS sale_date, s.sale_prc,
         row_number() OVER (PARTITION BY s.co_no, s.match_key ORDER BY s.sale_yr DESC, s.sale_mo DESC, s.sale_prc DESC) AS rn
    FROM dor.sdf_2026 s
   WHERE s.qual_cd IN ('01', '02') AND s.sale_prc > 100 AND s.sale_yr BETWEEN 1900 AND 2100 AND s.sale_mo BETWEEN 1 AND 12
), a AS (SELECT DISTINCT match_key, upper(regexp_replace(alt_key, '[^A-Za-z0-9]', '', 'g')) AS alt_norm FROM dor.nal_2026 WHERE co_no = 74)
SELECT q.co_no::smallint AS co_no,
       CASE WHEN q.co_no = 74 THEN a.alt_norm ELSE q.match_key END AS join_key,
       max(q.sale_date) FILTER (WHERE rn = 1) AS sale1_date, max(q.sale_prc) FILTER (WHERE rn = 1) AS sale1_price,
       max(q.sale_date) FILTER (WHERE rn = 2) AS sale2_date, max(q.sale_prc) FILTER (WHERE rn = 2) AS sale2_price,
       max(q.sale_date) FILTER (WHERE rn = 3) AS sale3_date, max(q.sale_prc) FILTER (WHERE rn = 3) AS sale3_price
  FROM q LEFT JOIN a ON q.co_no = 74 AND a.match_key = q.match_key
 WHERE rn <= 3 AND (q.co_no <> 74 OR a.alt_norm IS NOT NULL)
 GROUP BY 1, 2;
CREATE UNIQUE INDEX sales_last3_pk ON dor.sales_last3 (co_no, join_key);
