# 🔍 Spatial Search - Master Debug Guide

## Issue Summary
**Screenshot Evidence**: 1000 parcels returned when drawing a polygon, with most parcels clearly OUTSIDE the drawn area.

**Root Cause Analysis**: The spatial filter is either:
1. Not being sent from frontend to backend
2. Being stripped/ignored by validation
3. Not being applied in the SQL query
4. PostGIS migration not completed

---

## 🚨 CRITICAL FIRST CHECK: Is PostGIS Actually Working?

### Step 1: Verify Database State
Run these SQL queries directly against your database:

```sql
-- Check 1: Does centroid_geom column exist?
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'parcels' AND column_name = 'centroid_geom';

-- Check 2: Is PostGIS installed?
SELECT PostGIS_Version();

-- Check 3: How many parcels have valid geometry?
SELECT 
    COUNT(*) as total,
    COUNT(centroid_geom) as with_geometry,
    ROUND(100.0 * COUNT(centroid_geom) / NULLIF(COUNT(*), 0), 2) as pct
FROM parcels;
```

**If centroid_geom doesn't exist OR has 0 records**, run:
```sql
-- see: postgis_migration.sql in this folder
```

---

## 📡 Debugging the Data Flow

### The Complete Flow:
```
User draws polygon on map
         ↓
MapView.tsx captures coordinates [lon, lat]
         ↓
Creates GeoJSON Feature with Polygon geometry
         ↓
Calls onSearchArea(bbox, polygon)
         ↓
page.tsx/Dashboard receives and calls setFilters
         ↓
fetchData() sends POST to /api/parcels/search
         ↓
route.ts validates with Zod schema
         ↓
route.ts builds SQL with spatialShape
         ↓
PostGIS ST_Within() executed (if implemented)
         ↓
Results returned
```

### Checkpoints to Verify:

#### Checkpoint A: Frontend - MapView.tsx
Add this logging when "Search Area" is clicked (around line 726):

```javascript
console.log('[DEBUG-A1] Draw Points:', JSON.stringify(drawPoints));
console.log('[DEBUG-A2] Polygon:', JSON.stringify(polygon));
console.log('[DEBUG-A3] BBox:', bbox);
console.log('[DEBUG-A4] Calling onSearchArea with:', {
    bounds: [bbox[1], bbox[3], bbox[0], bbox[2]],
    shape: polygon
});
```

#### Checkpoint B: Dashboard/page.tsx
Add this in the setFilters or wherever onSearchArea is received:

```javascript
console.log('[DEBUG-B1] onSearchArea received:', { bounds, shape });
console.log('[DEBUG-B2] shape.geometry exists:', !!shape?.geometry);
console.log('[DEBUG-B3] shape.geometry.coordinates:', shape?.geometry?.coordinates);
```

#### Checkpoint C: API Call
Add this before the fetch call in fetchData:

```javascript
console.log('[DEBUG-C1] Filters being sent:', JSON.stringify(filters, null, 2));
console.log('[DEBUG-C2] spatialShape specifically:', filters.spatialShape);
```

#### Checkpoint D: Backend - route.ts
Add this after parsing the body (line ~55):

```typescript
console.log('[DEBUG-D1] spatialShape received:', spatialShape);
console.log('[DEBUG-D2] spatialShape type:', typeof spatialShape);
console.log('[DEBUG-D3] spatialShape keys:', spatialShape ? Object.keys(spatialShape) : 'null/undefined');
console.log('[DEBUG-D4] Full body:', JSON.stringify(body, null, 2));
```

---

## 🔧 Surgical Patches

### PATCH 1: Add Debug Logging to route.ts

Add after line 70 (after destructuring body):

```typescript
// ===== DEBUG LOGGING =====
console.log('==================== SPATIAL DEBUG ====================');
console.log('[SPATIAL] Input received:');
console.log('  - minLat:', minLat, 'maxLat:', maxLat);
console.log('  - minLon:', minLon, 'maxLon:', maxLon);
console.log('  - spatialShape:', spatialShape ? 'PRESENT' : 'MISSING');
if (spatialShape) {
    console.log('  - spatialShape type:', typeof spatialShape);
    console.log('  - spatialShape.type:', spatialShape.type);
    console.log('  - spatialShape.geometry:', spatialShape.geometry ? 'PRESENT' : 'MISSING');
    if (spatialShape.geometry || spatialShape.type === 'Polygon') {
        const geom = spatialShape.geometry || spatialShape;
        console.log('  - geom.type:', geom.type);
        console.log('  - coordinates[0].length:', geom.coordinates?.[0]?.length);
        console.log('  - First 3 coords:', JSON.stringify(geom.coordinates?.[0]?.slice(0, 3)));
    }
}
console.log('=======================================================');
// ===== END DEBUG =====
```

### PATCH 2: MapView.tsx - Add coordinate validation

Replace lines 714-731 with:

```javascript
// Finish Drawing POLYGON
if (drawPoints.length >= 3) {
    // Ensure polygon is closed properly
    const closedPoints = [...drawPoints, drawPoints[0]];
    
    const polygon = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [closedPoints]
        },
        properties: {}
    };
    
    // DEBUG: Log what we're sending
    console.log('==================== MAP DEBUG ====================');
    console.log('[MAP] Polygon created:');
    console.log('  - Points count:', closedPoints.length);
    console.log('  - Coordinates:', JSON.stringify(closedPoints));
    console.log('  - Sample point [lon, lat]:', closedPoints[0]);
    console.log('  - Lon range check (should be negative for Florida):', 
        closedPoints[0][0] < 0 ? 'VALID' : 'INVALID - LON SHOULD BE NEGATIVE');
    console.log('  - Lat range check (should be 24-31 for Florida):', 
        closedPoints[0][1] > 24 && closedPoints[0][1] < 31 ? 'VALID' : 'CHECK LAT');
    console.log('===================================================');
    
    try {
        // @ts-ignore
        const bbox = turf.bbox(polygon);
        console.log('[MAP] BBox calculated:', bbox);
        // bbox = [minLon, minLat, maxLon, maxLat]
        // We send as [minLat, maxLat, minLon, maxLon]
        
        if (onSearchArea) {
            console.log('[MAP] Calling onSearchArea with bounds:', [bbox[1], bbox[3], bbox[0], bbox[2]]);
            onSearchArea([bbox[1], bbox[3], bbox[0], bbox[2]], polygon);
        }
    } catch (e) {
        console.error('[MAP] Error calculating bbox', e);
    }
    setIsDrawing(false);
}
```

### PATCH 3: Fix potential empty object check in route.ts

The current check `if (spatialShape)` passes for empty objects `{}`.
Replace line 201 check with:

```typescript
// Check for valid spatialShape (not null, not undefined, not empty object)
const hasValidSpatialShape = spatialShape && 
    typeof spatialShape === 'object' && 
    Object.keys(spatialShape).length > 0 &&
    (spatialShape.geometry?.coordinates || spatialShape.coordinates);

if (hasValidSpatialShape) {
    console.log("[SPATIAL] Applying spatial filter to", rows.length, "candidates");
    // ... rest of filtering logic
}
```

---

## 🧪 Test SQL Queries

Run these directly to verify PostGIS is working:

```sql
-- Test 1: Simple point-in-polygon for Baker County (from screenshot)
-- Coordinates approximate to the drawn polygon area
SELECT COUNT(*) as total_in_polygon
FROM parcels
WHERE ST_Within(
    centroid_geom,
    ST_SetSRID(
        ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[
                [-82.35, 30.25],
                [-82.25, 30.25],
                [-82.25, 30.35],
                [-82.35, 30.35],
                [-82.35, 30.25]
            ]]
        }'),
        4326
    )
)
AND county = 'Baker';

-- Test 2: Compare with total Baker County parcels
SELECT COUNT(*) as total_baker FROM parcels WHERE county = 'Baker';
```

**Expected**: Test 1 should return FEWER than Test 2.
**If Test 1 returns 0**: The centroid_geom column is not populated or the coordinates are wrong.

---

## 📊 Decision Tree

```
Start Here
    │
    ├── Does centroid_geom column exist?
    │   ├── NO → Run postgis_migration.sql
    │   └── YES ↓
    │
    ├── Does centroid_geom have data?
    │   ├── NO → Run UPDATE portion of migration
    │   └── YES ↓
    │
    ├── Is PostGIS route.ts deployed?
    │   ├── NO → Deploy route_postgis_complete.ts
    │   └── YES ↓
    │
    ├── Check console logs: Is spatialShape being received?
    │   ├── NO / Empty → Bug in frontend or state management
    │   └── YES ↓
    │
    ├── Check console logs: Is ST_Within being called?
    │   ├── NO → Check the if(spatialShape) condition
    │   └── YES ↓
    │
    └── Check SQL: Does ST_Within return expected results?
        ├── NO → Coordinate format mismatch (lat/lon swap)
        └── YES → Bug is in result transformation
```

---

## 🎯 Most Likely Issues (In Order of Probability)

### 1. **PostGIS Not Implemented** (HIGHEST PROBABILITY)
The uploaded route.ts still uses JavaScript ray-casting, not PostGIS.
**Fix**: Deploy `route_postgis_complete.ts`

### 2. **centroid_geom Column Missing/Empty**
**Fix**: Run `postgis_migration.sql`

### 3. **spatialShape Is Empty Object**
Frontend sends `spatialShape: {}` instead of `null`
**Fix**: Add empty object check (PATCH 3 above)

### 4. **State Sync Issue Between Sidebar and Map**
Drawing a shape doesn't properly merge with other filters.
**Fix**: See handover brief - need to sync pending state

### 5. **Coordinate Order Swap**
Mapbox uses [lon, lat], some code expects [lat, lon]
**Fix**: Verify all coordinates are [lon, lat] format

---

## 📁 Files Reference

- `route_with_debug.ts` - Patched route.ts with extensive logging
- `MapView_with_debug.tsx` - Patched MapView with logging
- `verify_database.sql` - SQL to check database state
- `test_spatial_query.sql` - SQL to test PostGIS queries
- `debug_endpoint.ts` - Echo endpoint to verify request payload
