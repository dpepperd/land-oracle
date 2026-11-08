-- ============================================================
-- PostGIS Migration for Spatial Search
-- Land Oracle - Parcels Table
-- ============================================================
-- Run this script in psql or pgAdmin against your DigitalOcean database
-- Prerequisites: PostGIS extension must be installed

-- Step 1: Verify PostGIS is installed
SELECT PostGIS_Version();

-- Step 2: Check if geometry column already exists
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'parcels' AND column_name IN ('geom', 'centroid_geom');

-- ============================================================
-- Step 3: Add centroid_geom column for point-based searches
-- (Use this if parcels are stored as polygons but you need point centroids)
-- ============================================================

-- Add centroid point column if it doesn't exist
ALTER TABLE parcels 
ADD COLUMN IF NOT EXISTS centroid_geom geometry(Point, 4326);

-- Populate from existing lat/lon columns
-- Handles text columns (common issue)
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
  AND longitude ~ '^-?[0-9]+(\.[0-9]+)?$'  -- Regex check for valid number
  AND latitude ~ '^-?[0-9]+(\.[0-9]+)?$';

-- ============================================================
-- Step 4: Create Spatial Indexes (GIST)
-- ============================================================

-- Index on centroid_geom for point-in-polygon searches
CREATE INDEX IF NOT EXISTS idx_parcels_centroid_geom 
ON parcels USING GIST (centroid_geom);

-- Index on geom (if it exists and stores parcel boundaries)
CREATE INDEX IF NOT EXISTS idx_parcels_geom 
ON parcels USING GIST (geom);

-- ============================================================
-- Step 5: Analyze table for query planner
-- ============================================================
ANALYZE parcels;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check how many parcels have valid centroid_geom
SELECT 
    COUNT(*) as total_parcels,
    COUNT(centroid_geom) as with_centroid,
    COUNT(geom) as with_geom,
    ROUND(100.0 * COUNT(centroid_geom) / COUNT(*), 2) as centroid_pct
FROM parcels;

-- Verify SRID is correct (should be 4326)
SELECT DISTINCT ST_SRID(centroid_geom) as srid 
FROM parcels 
WHERE centroid_geom IS NOT NULL 
LIMIT 5;

-- Sample coordinates to verify order (lon should be negative for USA)
SELECT 
    parcel_id,
    ST_X(centroid_geom) as lon,
    ST_Y(centroid_geom) as lat,
    longitude as orig_lon,
    latitude as orig_lat
FROM parcels 
WHERE centroid_geom IS NOT NULL 
LIMIT 5;

-- ============================================================
-- TEST: Point-in-Polygon Query (Replace coordinates with your test polygon)
-- ============================================================

-- Example: Search for parcels within a triangle in Florida
-- This tests ST_Within with a manually created polygon
/*
SELECT parcel_id, county, acreage,
       ST_X(centroid_geom) as lon, 
       ST_Y(centroid_geom) as lat
FROM parcels
WHERE ST_Within(
    centroid_geom,
    ST_SetSRID(
        ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
        }'),
        4326
    )
)
LIMIT 10;
*/

SELECT 'Migration Complete' as status;
