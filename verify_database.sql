-- ============================================================
-- DATABASE VERIFICATION SCRIPT
-- Run ALL these queries to check database state for spatial search
-- ============================================================

-- ===== STEP 1: Check PostGIS Installation =====
SELECT 'PostGIS Version' as check_name, PostGIS_Version() as result;

-- ===== STEP 2: Check centroid_geom Column Exists =====
SELECT 
    'centroid_geom column' as check_name,
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING - RUN MIGRATION!' END as result
FROM information_schema.columns 
WHERE table_name = 'parcels' AND column_name = 'centroid_geom';

-- ===== STEP 3: Check Geometry Data Coverage =====
SELECT 
    'Geometry Coverage' as check_name,
    COUNT(*) as total_parcels,
    COUNT(centroid_geom) as with_geometry,
    ROUND(100.0 * COUNT(centroid_geom) / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM parcels;

-- ===== STEP 4: Check Spatial Index Exists =====
SELECT 
    'Spatial Index' as check_name,
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING - CREATE INDEX!' END as result
FROM pg_indexes 
WHERE tablename = 'parcels' AND indexdef LIKE '%GIST%centroid_geom%';

-- ===== STEP 5: Verify SRID =====
SELECT 
    'SRID Check' as check_name,
    ST_SRID(centroid_geom) as srid,
    CASE WHEN ST_SRID(centroid_geom) = 4326 THEN 'CORRECT' ELSE 'WRONG - SHOULD BE 4326!' END as status
FROM parcels 
WHERE centroid_geom IS NOT NULL 
LIMIT 1;

-- ===== STEP 6: Verify Coordinate Order (Lon should be negative for FL) =====
SELECT 
    'Sample Coordinates' as check_name,
    county,
    ST_X(centroid_geom) as lon,
    ST_Y(centroid_geom) as lat,
    CASE 
        WHEN ST_X(centroid_geom) < 0 AND ST_Y(centroid_geom) BETWEEN 24 AND 31 
        THEN 'VALID for Florida' 
        ELSE 'CHECK COORDINATES!'
    END as validation
FROM parcels 
WHERE centroid_geom IS NOT NULL 
LIMIT 5;

-- ===== STEP 7: Check Baker County Specifically (from screenshot) =====
SELECT 
    'Baker County' as check_name,
    COUNT(*) as total_parcels,
    COUNT(centroid_geom) as with_geometry
FROM parcels 
WHERE county = 'Baker';

-- ===== STEP 8: Test a Simple Spatial Query =====
-- This should return SOME results if PostGIS is working correctly
-- Using approximate coordinates from the screenshot (Baker County area)
SELECT 
    'Simple Spatial Test' as check_name,
    COUNT(*) as parcels_in_test_area
FROM parcels
WHERE centroid_geom IS NOT NULL
AND ST_Within(
    centroid_geom,
    ST_SetSRID(
        ST_MakeEnvelope(-82.5, 30.2, -82.2, 30.5),
        4326
    )
)
AND county = 'Baker';

-- ===== SUMMARY =====
SELECT '========================================' as line;
SELECT 'If any checks show issues, run:' as action;
SELECT '  - postgis_migration.sql if centroid_geom missing/empty' as step1;
SELECT '  - CREATE INDEX if spatial index missing' as step2;
SELECT '========================================' as line;
