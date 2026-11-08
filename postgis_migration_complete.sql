-- ============================================================
-- COMPLETE PostGIS Migration Script
-- Run this ONCE to set up spatial search capability
-- ============================================================

-- Step 1: Ensure PostGIS extension exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify
SELECT 'PostGIS installed:' as step, PostGIS_Version() as result;

-- ============================================================
-- Step 2: Add centroid_geom column
-- ============================================================
ALTER TABLE parcels 
ADD COLUMN IF NOT EXISTS centroid_geom geometry(Point, 4326);

SELECT 'centroid_geom column:' as step, 'Added' as result;

-- ============================================================
-- Step 3: Populate geometry from lat/lon
-- ============================================================

-- First, let's see what format lat/lon are in
SELECT 'Sample coordinates:' as step;
SELECT latitude, longitude, 
       pg_typeof(latitude) as lat_type,
       pg_typeof(longitude) as lon_type
FROM parcels 
WHERE latitude IS NOT NULL 
LIMIT 3;

-- Update: Handle TEXT columns (most common issue)
UPDATE parcels 
SET centroid_geom = ST_SetSRID(
    ST_MakePoint(
        CAST(longitude AS DOUBLE PRECISION),
        CAST(latitude AS DOUBLE PRECISION)
    ), 
    4326
)
WHERE centroid_geom IS NULL 
  AND longitude IS NOT NULL 
  AND latitude IS NOT NULL
  -- Regex to ensure valid numbers
  AND longitude::text ~ '^-?[0-9]+\.?[0-9]*$'
  AND latitude::text ~ '^-?[0-9]+\.?[0-9]*$'
  -- Basic sanity check for Florida
  AND CAST(longitude AS DOUBLE PRECISION) BETWEEN -88 AND -79
  AND CAST(latitude AS DOUBLE PRECISION) BETWEEN 24 AND 32;

SELECT 'Geometries populated:' as step, COUNT(*) as count 
FROM parcels WHERE centroid_geom IS NOT NULL;

-- ============================================================
-- Step 4: Create Spatial Index (CRITICAL for performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_parcels_centroid_geom 
ON parcels USING GIST (centroid_geom);

SELECT 'Spatial index:' as step, 'Created' as result;

-- ============================================================
-- Step 5: Analyze for query planner
-- ============================================================
ANALYZE parcels;

SELECT 'Table analyzed:' as step, 'Complete' as result;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '========== VERIFICATION ==========' as header;

SELECT 
    'Coverage' as metric,
    COUNT(*) as total_parcels,
    COUNT(centroid_geom) as with_geometry,
    ROUND(100.0 * COUNT(centroid_geom) / NULLIF(COUNT(*), 0), 2) || '%' as coverage
FROM parcels;

-- Test query
SELECT 
    'Test Query' as metric,
    COUNT(*) as parcels_found
FROM parcels
WHERE ST_Within(
    centroid_geom,
    ST_SetSRID(
        ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[-82.5, 30.2], [-82.2, 30.2], [-82.2, 30.5], [-82.5, 30.5], [-82.5, 30.2]]]
        }'),
        4326
    )
);

SELECT '========== MIGRATION COMPLETE ==========' as status;
SELECT 'You can now deploy route_postgis_complete.ts' as next_step;
