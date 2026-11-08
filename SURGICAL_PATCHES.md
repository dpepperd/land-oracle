# Surgical Patches for Spatial Search Fix

## 📋 Pre-Flight Checklist

Before applying ANY patches, verify:

```bash
# 1. Check if PostGIS centroid_geom exists
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='parcels' AND column_name='centroid_geom';"

# 2. Check if it has data
psql -c "SELECT COUNT(*) FROM parcels WHERE centroid_geom IS NOT NULL;"
```

**If centroid_geom doesn't exist or is empty → Run the migration first!**

---

## PATCH A: Fix Empty Object Check in route.ts

**File**: `app/api/parcels/search/route.ts`
**Line**: ~201 (the `if (spatialShape)` check)

### FIND THIS:
```typescript
if (spatialShape) {
    console.log("Applying Spatial Filter to", rows.length, "candidates");
```

### REPLACE WITH:
```typescript
// Robust check for valid spatialShape
const hasValidSpatialShape = spatialShape && 
    typeof spatialShape === 'object' && 
    Object.keys(spatialShape).length > 0 &&
    (spatialShape.geometry?.coordinates || spatialShape.coordinates);

if (hasValidSpatialShape) {
    console.log("[SPATIAL] Applying filter to", rows.length, "candidates");
    console.log("[SPATIAL] Shape type:", spatialShape.type || spatialShape.geometry?.type);
```

---

## PATCH B: Add Coordinate Logging in MapView.tsx

**File**: `components/dashboard/MapView.tsx`
**Line**: ~714-731 (inside the "Search Area" click handler)

### FIND THIS:
```javascript
if (drawPoints.length >= 3) {
    const polygon = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[...drawPoints, drawPoints[0]]]
        }
    };
```

### REPLACE WITH:
```javascript
if (drawPoints.length >= 3) {
    // Close the polygon properly
    const closedRing = [...drawPoints, drawPoints[0]];
    
    const polygon = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [closedRing]
        },
        properties: {}
    };
    
    // === DEBUG LOGGING ===
    console.log('=== SPATIAL SEARCH DEBUG ===');
    console.log('Points drawn:', drawPoints.length);
    console.log('Closed ring:', closedRing.length, 'points');
    console.log('First point [lon,lat]:', closedRing[0]);
    console.log('Lon is negative:', closedRing[0][0] < 0);
    console.log('Full polygon:', JSON.stringify(polygon));
    console.log('============================');
```

---

## PATCH C: Ensure spatialShape is Passed to API

**File**: `app/dashboard/page.tsx` (or wherever fetchData is defined)

### FIND the fetch call that looks like:
```javascript
const res = await fetch('/api/parcels/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
});
```

### ADD logging before it:
```javascript
// === DEBUG: Log what we're sending ===
console.log('=== API REQUEST DEBUG ===');
console.log('Full filters object:', filters);
console.log('spatialShape present:', !!filters.spatialShape);
console.log('spatialShape value:', filters.spatialShape);
if (filters.spatialShape) {
    console.log('spatialShape.geometry:', filters.spatialShape.geometry);
}
console.log('=========================');

const res = await fetch('/api/parcels/search', {
    // ... rest of fetch
});
```

---

## PATCH D: Fix Coordinate Order in route.ts (if using JS fallback)

**File**: `app/api/parcels/search/route.ts`
**Line**: ~218 (inside the filter function)

### FIND THIS:
```typescript
return isPointInPolygon([lon, lat], polygonPoints);
```

### ADD VALIDATION BEFORE IT:
```typescript
// Validate point coordinates
if (lon > 0 || lat < 0) {
    console.warn('[SPATIAL] Suspicious coords for row:', row.parcel_id, 'lon:', lon, 'lat:', lat);
}

// Validate polygon coordinates  
const firstPoly = polygonPoints[0];
if (firstPoly && (firstPoly[0] > 0 || firstPoly[1] < 0)) {
    console.warn('[SPATIAL] Suspicious polygon coords:', firstPoly);
}

return isPointInPolygon([lon, lat], polygonPoints);
```

---

## PATCH E: Deploy PostGIS Solution (RECOMMENDED)

If centroid_geom exists and has data, replace entire route.ts with `route_postgis_complete.ts`:

```bash
# Backup current
cp app/api/parcels/search/route.ts app/api/parcels/search/route.ts.backup

# Deploy PostGIS version
cp /home/ubuntu/land-oracle-postgis/route_postgis_complete.ts app/api/parcels/search/route.ts
```

---

## Quick Verification Script

After applying patches, test with browser console:

```javascript
// Run this in browser console on the dashboard page
// After drawing a polygon and clicking "Search Area"

// Check Network tab for the POST request to /api/parcels/search
// Look for spatialShape in the request payload

// Or manually test:
fetch('/api/parcels/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        counties: ['Baker'],
        landUse: ['001'],
        limit: 100,
        spatialShape: {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-82.35, 30.25],
                    [-82.25, 30.25],
                    [-82.25, 30.35],
                    [-82.35, 30.35],
                    [-82.35, 30.25]
                ]]
            }
        }
    })
}).then(r => r.json()).then(console.log);
```

Expected: Should return < 100 parcels (strict containment), not 1000.
