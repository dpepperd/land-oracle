
// Mock of the implementation in route.ts
function isPointInPolygon(point, vs) {
    if (!point || point.length < 2 || !vs || vs.length < 3) return false;
    
    const x = point[0], y = point[1]; // x = lon, y = lat
    let inside = false;
    
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Mock of normalize
function normalizePolygonCoordinates(coords) {
    if (!Array.isArray(coords) || coords.length < 3) return null;
    return coords.map(coord => {
        const lon = parseFloat(coord[0]);
        const lat = parseFloat(coord[1]);
        // Florida: Lat ~24-31 (Pos), Lon ~-87 to -80 (Neg)
        if (lon > 0 && lat < 0) { // Swapped!
             return [lat, lon];
        }
        return [lon, lat];
    });
}

// TEST CASES (Florida Context)
// A simple square around Jacksonville roughly
const polygonCorrect = [
    [-82.0, 30.0], // Lon, Lat
    [-81.0, 30.0],
    [-81.0, 31.0],
    [-82.0, 31.0],
    [-82.0, 30.0] 
];

const pointInside = [-81.5, 30.5]; // Middle of square
const pointOutside = [-83.0, 30.5]; // Too far West

console.log("Test 1: Normal Polygon");
console.log("Inside Point:", isPointInPolygon(pointInside, polygonCorrect)); // Expect TRUE
console.log("Outside Point:", isPointInPolygon(pointOutside, polygonCorrect)); // Expect FALSE

// Swapped Coords Case
const polygonSwapped = [
    [30.0, -82.0], // Lat, Lon
    [30.0, -81.0],
    [31.0, -81.0],
    [31.0, -82.0],
    [30.0, -82.0]
];
const fixedPoly = normalizePolygonCoordinates(polygonSwapped);
console.log("\nTest 2: Swapped Polygon (Auto-Fix)");
console.log("Fixed Vertices[0]:", fixedPoly[0]); // Expect [-82, 30]
console.log("Inside Point:", isPointInPolygon(pointInside, fixedPoly)); // Expect TRUE

