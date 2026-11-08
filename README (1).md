# 🗺️ Land Oracle Spatial Search Debug Package

## Problem
Drawing a polygon on the map returns **1000 parcels** (the LIMIT), with most parcels clearly **outside** the drawn area. The spatial filter is not working.

---

## Files in This Package

| File | Purpose |
|------|---------|
| `MASTER_DEBUG_GUIDE.md` | Complete debugging guide with decision tree |
| `SURGICAL_PATCHES.md` | Exact code changes to fix the issue |
| `route_with_debug.ts` | API route with extensive logging |
| `debug_endpoint.ts` | Echo endpoint to verify request payload |
| `verify_database.sql` | SQL to check database state |
| `postgis_migration_complete.sql` | Full migration script for PostGIS |
| `browser_test.js` | Paste in browser console to test API |

---

## Quick Start: Diagnose in 5 Minutes

### Step 1: Check Database
```sql
-- Run in your database
SELECT COUNT(*) as total, COUNT(centroid_geom) as with_geom FROM parcels;
```

**If with_geom = 0** → Run `postgis_migration_complete.sql`

### Step 2: Check Request Payload
1. Open browser DevTools (F12)
2. Go to Network tab
3. Draw a polygon and click "Search Area"
4. Find the POST to `/api/parcels/search`
5. Check Request Payload for `spatialShape`

**If spatialShape is missing or empty** → Bug in frontend state management

### Step 3: Run Browser Test
Paste contents of `browser_test.js` into browser console. It will tell you if the spatial filter is working.

---

## Most Likely Root Causes

### 🔴 Cause #1: PostGIS Not Set Up (90% probability)
The uploaded `route.ts` uses JavaScript ray-casting which runs AFTER the SQL query. If the bounding box returns 1000 rows (the limit), only those 1000 are filtered, missing many valid parcels.

**Fix:** 
1. Run `postgis_migration_complete.sql` 
2. Deploy `/home/ubuntu/land-oracle-postgis/route_postgis_complete.ts`

### 🟡 Cause #2: Empty spatialShape Object
Frontend sends `spatialShape: {}` which passes `if (spatialShape)` but has no data.

**Fix:** Apply PATCH A from `SURGICAL_PATCHES.md`

### 🟡 Cause #3: State Sync Issue
Sidebar filters and map spatial filter overwrite each other.

**Fix:** See `handover brief search and spacial.txt` for architecture analysis

---

## Deployment Steps

```bash
# 1. Run database migration
psql $DATABASE_URL -f /home/ubuntu/land-oracle-debug/postgis_migration_complete.sql

# 2. Verify
psql $DATABASE_URL -f /home/ubuntu/land-oracle-debug/verify_database.sql

# 3. Deploy PostGIS route (backup first!)
cp app/api/parcels/search/route.ts app/api/parcels/search/route.ts.backup
cp /home/ubuntu/land-oracle-postgis/route_postgis_complete.ts app/api/parcels/search/route.ts

# 4. Restart Next.js
npm run dev  # or pm2 restart

# 5. Test
# Paste browser_test.js into console
```

---

## Expected Console Output (After Fix)

### Server logs when spatial search works:
```
[PostGIS] Applying polygon filter with 5 vertices
[PostGIS] Query returned 47 results
```

### Browser test when working:
```
📊 Results Analysis:
  ✅ Inside bbox: 47
  ❌ Outside bbox: 0
✅ All parcels are within the bounding box!
```

---

## Still Broken After All Fixes?

Check these edge cases:

1. **Coordinate swap**: Mapbox is [lon, lat], database might be [lat, lon]
2. **SRID mismatch**: Both must be 4326
3. **Winding order**: PostGIS expects counter-clockwise (CCW)
4. **Invalid geometry**: Self-intersecting polygons fail silently

Run `verify_database.sql` for all checks.
