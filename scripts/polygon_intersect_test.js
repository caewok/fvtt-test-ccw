// Test if two polygons intersect (overlap)
// Adapted from first portion of https://www.codeproject.com/Articles/15573/2D-Polygon-Collision-Detection

/** Testing
QBenchmarkLoopFn = api.bench.QBenchmarkLoopFn
QBenchmarkLoop = api.bench.QBenchmarkLoop


let [tokenA, tokenB] = canvas.tokens.controlled;
polyA = tokenA.bounds.toPolygon();
polyB = tokenB.bounds.toPolygon();
polygonsOverlap(polyA, polyB)

n = 1000
await QBenchmarkLoop(n, polyA, "intersectPolygon", polyB);
await QBenchmarkLoopFn(n, polygonsOverlap, "overlap", polyA, polyB);

*/


/**
 * Check if polygonA and polygonB overlap.
 * Only works for convex polygons!
 * @param {PIXI.Polygon} polyA
 * @param {PIXI.Polygon} polyB
 * @return {Boolean}
 */
export function polygonsOverlap(polyA, polyB) {
  for ( const edge of polyA.iterateEdges() ) {
    const axis = new PIXI.Point(-(edge.B.y - edge.A.y), edge.B.x - edge.A.x);
    const axisN = normalize(axis);
    const [minA, maxA] = projectPolygon(axis, polyA);
    const [minB, maxB] = projectPolygon(axis, polyB);

    // Check if the polygon projections are currently intersecting
    if ( intervalDistance(minA, maxA, minB, maxB) > 0 ) { return false; }
  }

  for ( const edge of polyB.iterateEdges() ) {
    const axis = new PIXI.Point(-(edge.B.y - edge.A.y), edge.B.x - edge.A.x);
    const axisN = normalize(axis);
    const [minA, maxA] = projectPolygon(axis, polyA);
    const [minB, maxB] = projectPolygon(axis, polyB);

    // Check if the polygon projections are currently intersecting
    if ( intervalDistance(minA, maxA, minB, maxB) > 0 ) { return false; }
  }

  return true;
}


/**
 * Dot product of two points (vectors)
 * @param {Point} a
 * @param {Point} b
 * @param {Number}
 */
function dotProduct(a, b) { return a.x * b.x + a.y * b.y; }

/**
 * Normalize a vector: divide each component by the magnitude.
 * @param {Point} p
 * @return {Point}
 */
function normalize(p) {
  const magnitude = Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
  return new PIXI.Point(p.x / magnitude, p.y / magnitude);
}


/**
 * Calculate the distance between two intervals.
 * Distance will be negative if the intervals overlap.
 * @param {Number} minA
 * @param {Number} maxA
 * @param {Number} minB
 * @param {Number} maxB
 * @return {Number}
 */
function intervalDistance(minA, maxA, minB, maxB) {
  return (minA < minB) ? (minB - maxA) : (minA - maxB);
}

/**
 * Calculate the projection of a polygon on an axis.
 * Return it as a [min, max] interval
 * @param {Point}         axis    X and Y vector (delta) representing the axis
 * @param {PIXI.Polygon}  poly    Polygon or other object with points.
 * @return {[Number, Number]} Min and max interval for the points.
 */
function projectPolygon(axis, poly) {
  const projected_points = [...poly.iteratePoints({close: false})].map(pt => dotProduct(pt, axis));
  return [ Math.min(...projected_points), Math.max(...projected_points)];
}


