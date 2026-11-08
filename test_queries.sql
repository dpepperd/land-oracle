-- ============================================================
-- PostGIS Test Queries for Spatial Search Verification
-- Run these directly in psql to verify the database layer works
-- ============================================================

-- ============================================================
-- TEST 1: Basic Point-in-Polygon (Florida example)
-- ============================================================

-- This creates a small triangle and checks if any parcels fall within it
-- Replace coordinates with actual values from your dataset

WITH test_polygon AS (
    SELECT ST_MakeValid(
        ST_ForcePolygonCCW(
            ST_SetSRID(
                ST_GeomFromGeoJSON('{
                    "type": "Polygon",
                    "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
                }'),
                4326
            )
        )
    ) AS geom
)
SELECT 
    p.parcel_id,
    p.county,
    p.acreage,
    ST_X(p.centroid_geom) AS lon,
    ST_Y(p.centroid_geom) AS lat
FROM parcels p, test_polygon t
WHERE ST_Within(p.centroid_geom, t.geom)
LIMIT 20;

-- ============================================================
-- TEST 2: Verify winding order handling
-- ============================================================

-- Test with CLOCKWISE coordinates (should still work due to ST_ForcePolygonCCW)
SELECT ST_AsText(
    ST_ForcePolygonCCW(
        ST_SetSRID(
            ST_GeomFromGeoJSON('{
                "type": "Polygon",
                "coordinates": [[[-81.5, 28.5], [-81.4, 28.7], [-81.3, 28.5], [-81.5, 28.5]]]
            }'),
            4326
        )
    )
) AS normalized_polygon;

-- ============================================================
-- TEST 3: Compare ST_Within vs ST_Intersects
-- ============================================================

-- ST_Within should return FEWER results (strict containment)
-- ST_Intersects returns parcels that touch the boundary too

WITH test_polygon AS (
    SELECT ST_SetSRID(
        ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
        }'),
        4326
    ) AS geom
)
SELECT 
    'ST_Within' AS method,
    COUNT(*) AS parcel_count
FROM parcels p, test_polygon t
WHERE ST_Within(p.centroid_geom, t.geom)
UNION ALL
SELECT 
    'ST_Intersects' AS method,
    COUNT(*) AS parcel_count
FROM parcels p, test_polygon t
WHERE ST_Intersects(p.centroid_geom, t.geom);

-- ============================================================
-- TEST 4: Performance check with EXPLAIN ANALYZE
-- ============================================================

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT parcel_id, county
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
LIMIT 100;

-- Expected output should show:
-- "Index Scan using idx_parcels_centroid_geom on parcels"
-- NOT "Seq Scan on parcels"

-- ============================================================
-- TEST 5: Bounding Box + Polygon combined (like the actual query)
-- ============================================================

WITH test_polygon AS (
    SELECT 
        ST_MakeValid(
            ST_ForcePolygonCCW(
                ST_SetSRID(ST_GeomFromGeoJSON('{
                    "type": "Polygon",
                    "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
                }'), 4326)
            )
        ) AS geom
)
SELECT 
    p.parcel_id,
    p.county,
    p.acreage,
    p.owner_name
FROM parcels p, test_polygon t
WHERE 
    -- GIST index scan first (fast bounding box)
    p.centroid_geom && ST_Envelope(t.geom)
    -- Then precise containment check
    AND ST_Within(p.centroid_geom, t.geom)
    -- Additional filters
    AND p.county = 'ORANGE'
LIMIT 50;

-- ============================================================
-- TEST 6: Circle query using ST_DWithin
-- ============================================================

-- Find parcels within 5 miles of a point
-- Note: ST_DWithin with geography uses meters, so 5 miles = 8046.72 meters

SELECT 
    parcel_id,
    county,
    ST_Distance(
        centroid_geom::geography,
        ST_SetSRID(ST_MakePoint(-81.4, 28.6), 4326)::geography
    ) / 1609.34 AS distance_miles
FROM parcels
WHERE ST_DWithin(
    centroid_geom::geography,
    ST_SetSRID(ST_MakePoint(-81.4, 28.6), 4326)::geography,
    8046.72  -- 5 miles in meters
)
ORDER BY distance_miles
LIMIT 20;

-- ============================================================
-- TEST 7: Debug - Check what coordinates look like
-- ============================================================

SELECT 
    parcel_id,
    latitude,
    longitude,
    ST_AsText(centroid_geom) AS centroid_wkt,
    ST_X(centroid_geom) AS extracted_lon,
    ST_Y(centroid_geom) AS extracted_lat
FROM parcels
WHERE centroid_geom IS NOT NULL
LIMIT 5;

-- ============================================================
-- TEST 8: Full simulation of API query
-- ============================================================

-- This simulates exactly what the patched route.ts will run
-- Replace $1, $2 etc. with actual values

-- Variables (simulate parameterized query)
-- $1 = '{"type":"Polygon","coordinates":[[[-81.5,28.5],[-81.3,28.5],[-81.4,28.7],[-81.5,28.5]]]}'
-- $2 = '{ORANGE}' (county array)
-- $3 = 'user_clerk_id'
-- $4 = 1000 (limit)

WITH user_context AS (
    SELECT id, role FROM users WHERE clerk_id = 'test_user' LIMIT 1
)
SELECT 
    p.id,
    p.parcel_id,
    p.county,
    p.owner_name,
    p.acreage,
    p.latitude,
    p.longitude
FROM parcels p
WHERE 1=1
    AND ST_Within(
        centroid_geom,
        ST_MakeValid(
            ST_ForcePolygonCCW(
                ST_SetSRID(
                    ST_GeomFromGeoJSON('{
                        "type": "Polygon",
                        "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
                    }'),
                    4326
                )
            )
        )
    )
    AND county = ANY('{ORANGE}')
LIMIT 1000;
