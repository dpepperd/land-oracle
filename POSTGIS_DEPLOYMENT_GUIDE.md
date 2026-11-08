# PostGIS Spatial Search - Deployment Guide

## Overview

This guide migrates the spatial search from JavaScript ray-casting to native PostGIS functions, which are:
- **Battle-tested**: Used by millions of applications worldwide
- **Coordinate-aware**: Handles SRID, winding order, and edge cases automatically
- **Performant**: Leverages GIST spatial indexes for sub-millisecond queries

---

## Pre-Requisites

1. PostgreSQL database with PostGIS extension installed
2. `parcels` table with `latitude` and `longitude` columns
3. Database connection credentials

---

## Step 1: Run the Migration SQL

### Option A: Using psql

```bash
psql "postgresql://user:password@host:port/database?sslmode=require" -f postgis_migration.sql
```

### Option B: Using DigitalOcean Console

1. Go to your Database cluster in DigitalOcean
2. Click "Connection Pools" or use the direct connection string
3. Open a SQL console or use `psql`
4. Paste and run the contents of `postgis_migration.sql`

### Expected Output

```
 postgis_version
----------------
 3.x.x

 total_parcels | with_centroid | with_geom | centroid_pct
---------------+---------------+-----------+--------------
        50000 |         49900 |     50000 |        99.80

 status
-------------------
 Migration Complete
```

---

## Step 2: Verify the Migration

Run these verification queries:

```sql
-- Check spatial index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'parcels' AND indexname LIKE '%geom%';

-- Test a point-in-polygon query (use real coordinates from your data)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM parcels
WHERE ST_Within(
    centroid_geom,
    ST_SetSRID(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
    }'), 4326)
);
```

The `EXPLAIN ANALYZE` should show "Index Scan using idx_parcels_centroid_geom".

---

## Step 3: Apply the Route.ts Patch

Follow the instructions in `patch_route_postgis.txt`:

1. **Locate** the spatial filtering section (~lines 111-134)
2. **Replace** the bounding box logic with PostGIS query
3. **Remove** the JavaScript 2nd-pass filter (~lines 199-235)
4. **Remove** the helper functions (isPointInPolygon, etc.)

### Quick Patch (Copy-Paste Ready)

Replace the entire spatial filtering block with:

```typescript
// ==== PostGIS Spatial Filtering ====
if (spatialShape && typeof spatialShape === 'object' && Object.keys(spatialShape).length > 0) {
    const geom = spatialShape.geometry || spatialShape;
    
    if (geom && geom.type === 'Polygon' && geom.coordinates) {
        console.log('[PostGIS] Applying polygon filter');
        conditions.push(`
            ST_Within(
                centroid_geom,
                ST_MakeValid(ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON($${valIdx}), 4326)))
            )
        `);
        values.push(JSON.stringify(geom));
        valIdx++;
    }
} else if (minLat && maxLat && minLon && maxLon) {
    console.log('[PostGIS] Applying bounding box filter');
    conditions.push(`centroid_geom && ST_MakeEnvelope($${valIdx}, $${valIdx + 1}, $${valIdx + 2}, $${valIdx + 3}, 4326)`);
    values.push(minLon, minLat, maxLon, maxLat);
    valIdx += 4;
}
```

---

## Step 4: Test the Integration

### A. Direct SQL Test

```sql
-- Replace with a real polygon from your frontend
SELECT parcel_id, county, acreage
FROM parcels
WHERE ST_Within(
    centroid_geom,
    ST_MakeValid(ST_ForcePolygonCCW(ST_SetSRID(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[[-81.5, 28.5], [-81.3, 28.5], [-81.4, 28.7], [-81.5, 28.5]]]
    }'), 4326)))
)
AND county = 'ORANGE'
LIMIT 10;
```

### B. Frontend Test

1. Open Chrome DevTools > Network tab
2. Draw a polygon on the map
3. Check the request payload has `spatialShape` with valid GeoJSON
4. Verify response only contains parcels inside the polygon

### C. Log Verification

Check your server logs for:
```
[PostGIS] Applying polygon filter with X vertices
[PostGIS] Query returned Y results
```

---

## Troubleshooting

### Issue: "column centroid_geom does not exist"

**Cause**: Migration not run or failed  
**Fix**: Run `postgis_migration.sql` again

### Issue: Query returns no results

**Cause**: SRID mismatch or winding order  
**Fix**: Ensure ST_SetSRID(4326) is applied and ST_ForcePolygonCCW is used

### Issue: Query returns all results (ignoring polygon)

**Cause**: spatialShape is empty `{}` or malformed  
**Fix**: Add logging to check what's being received:
```typescript
console.log('[DEBUG] spatialShape:', JSON.stringify(spatialShape));
```

### Issue: Very slow queries

**Cause**: Spatial index not being used  
**Fix**: Run `ANALYZE parcels;` and check with EXPLAIN:
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ... WHERE ST_Within(...);
```

---

## PostGIS Function Reference

| Function | Use Case |
|----------|----------|
| `ST_Within(A, B)` | A is completely inside B (strict) |
| `ST_Contains(A, B)` | A contains B (inverse of Within) |
| `ST_Intersects(A, B)` | A and B share any space (less strict) |
| `ST_CoveredBy(A, B)` | A is covered by B (handles edge cases) |
| `ST_DWithin(A, B, dist)` | A is within distance of B (for circles) |
| `ST_MakeValid(geom)` | Fix self-intersecting polygons |
| `ST_ForcePolygonCCW(geom)` | Ensure counter-clockwise winding |

---

## Files in This Package

1. `postgis_migration.sql` - Database setup script
2. `patch_route_postgis.txt` - Code changes for route.ts
3. `POSTGIS_DEPLOYMENT_GUIDE.md` - This file
4. `test_queries.sql` - Test queries for verification
