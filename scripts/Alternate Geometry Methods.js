// Test alternate orientation and intersection measurements from GTL

/**
 * Determine if a number is odd
 */
function isOdd(num) { return num % 2;}

/**
 * Compare the slopes of two lines.
 * From GTL_boostcon_draft03_no_animation.ppt
 * Cross-multiplication avoids integer truncation of division.
 *
 * @param {Point} a			First point on line A|B
 * @param {Point} b			Second point on line A|B
 * @param {Point} c			First point on line C|D
 * @param {Point} d 		Second point on line C|D
 *
 * @return {Number} Less than 0 if A|B slope is smaller than C|D slope.
 *                  Greater than 0 if A|B slope is larger.
 *                  Zero if slopes are equal.
 */
function slopeCompare(a, b, c, d) {
  return ((b.y - a.y) * (d.x - c.x)) - ((b.x - a.x) * (d.y - c.y));
}

/**
 * Determine whether a point is on, above, or below a segment A|B.
 * Alternative version of orient2d.
 *
 * @param {Point} a			First point on line A|B
 * @param {Point} b			Second point on line A|B
 * @param {Point} c			Point to compare
 *
 * @return {Number} See slopeCompare
 */
function pointLineCompare(a, b, c) {
  return slopeCompare(a, b, a, c);
}



/**
 * Compute whether two segments intersect.
 * Comparable to foundry.utils.lineSegmentIntersects.
 *
 * @param {Point} a			First point on line A|B
 * @param {Point} b			Second point on line A|B
 * @param {Point} c			First point on line C|D
 * @param {Point} d 		Second point on line C|D
 *
 * @return {Boolean} True if segments intersect.
 */
function lineSegmentIntersects(a, b, c, d) {
  const cmp1 = pointLineCompare(a, b, c);
  const cmp2 = pointLineCompare(a, b, d);
  return cmp1 !== cmp2;
}

/**
 * Determine if a point is inside a polygon.
 *
 * @param {PIXI.Polygon} poly		Points as in PIXI.Polygon.points
 * @param {Point} a           Point to test.
 * @return {Boolean} True if the point a is inside the polygon
 */
function pointInPolygon(poly, a) {
  // for all edges that contain the x value of the point within their x interval:
  // accumulate the sum of such edges that the point is above (ccw)
  // Point is inside if the sum is odd

  const iter = poly.iteratePoints();
  let p0 = iter.next().value;
  let edge_sum = 0;
  for(const p1 of iter) {
    // console.log(`${p0.x},${p0.y}|${p1.x},${p1.y}`);
    if(p1.x.between(p0.x, p1.x) && pointLineCompare(p0, p1, a) > 0) { edge_sum += 1; }
    p0 = p1;
  }

  return isOdd(edge_sum);
}

/**
 * Slope intercept comparison
 * ??
 *
 * @param {Point} a			First point on line A|B
 * @param {Point} b			Second point on line A|B
 * @param {Point} c			First point on line C|D
 * @param {Point} d 		Second point on line C|D
 *
 * @return {Boolean} ?
*/
function slopeInterceptCompare(a, b, c, d) {
  const dx1 = b.x - a.x;
  const dx2 = d.x - c.x;
  const dy1 = b.y - a.y;
  const dy2 = d.y - c.y;

  const cmp1 = dx2 * (dx1 * dy1 + a.y * dx1);
  const cmp2 = dx1 * (dx2 * dy2 + c.y * dx2);

  return cmp1 < cmp2;
}


/**
 * Calculate the intersection of two infinite lines.
 * Requires only single division for each coordinate, calculated last.
 *
 * @param {Point} a			First point on line A|B
 * @param {Point} b			Second point on line A|B
 * @param {Point} c			First point on line C|D
 * @param {Point} d 		Second point on line C|D
 *
 * @return {Point} Line intersection coordinates.
 */
function lineLineIntersection(a, b, c, d) {
  const dx1 = b.x - a.x;
  const dx2 = d.x - c.x;
  const dy1 = b.y - a.y;
  const dy2 = d.y - c.y;

  const x_num = a.x * dy1 * dx2 - c.x * dy2 * dx1 + c.y * dx1 * dx2 - a.y * dx1 * dx2;
  const y_num = a.y * dx1 * dy2 - c.y * dx2 * dy1 + c.x * dy1 * dy2 - a.x * dy1 * dy2;

  const x_dnm = dy1 * dx2 - dy2 * dx1;
  const y_dnm = dx1 * dy2 - dx2 * dy1;

  return { x: x_num / x_dnm, y: y_num / y_dnm };
}


walls = [...canvas.walls.placeables]

// 0 is diagonal
// 1 is horizontal top
// 2 is horizontal bottom
// 0 intersects 1 but not 2
// 0.A, 1.B, 2.B, 2.A, 1.A form polygon with 0.B inside

w0 = walls[0];
w1 = walls[1];
w2 = walls[2];

poly = new PIXI.Polygon([ w0.A.x, w0.A.y,
                          w1.B.x, w1.B.y,
                          w2.B.x, w2.B.y,
                          w2.A.x, w2.A.y,
                          w1.A.x, w1.A.y,
                          w0.A.x, w0.A.y ]);


slopeCompare(w0.A, w0.B, w1.A, w1.A)
slopeCompare(w0.A, w0.B, w1.A, w1.B)
slopeCompare(w1.A, w1.B, w2.A, w2.B)
slopeCompare(w0.B, w0.A, w1.A, w1.B)

pointLineCompare(w0.A, w0.B, w1.A)
pointLineCompare(w0.A, w0.B, w1.B)

foundry.utils.orient2dFast(w0.A, w0.B, w1.A)
foundry.utils.orient2dFast(w0.A, w0.B, w1.B)

slopeInterceptCompare(w0.A, w0.B, w1.A, w1.B)
lineSegmentIntersects(w0.A, w0.B, w1.A, w1.B)
foundry.utils.lineSegmentIntersects(w0.A, w0.B, w1.A, w1.B)

lineLineIntersection(w0.A, w0.B, w1.A, w1.B)
foundry.utils.lineSegmentIntersection(w0.A, w0.B, w1.A, w1.B)

lineLineIntersection(w2.A, w2.B, w1.A, w1.B)
foundry.utils.lineSegmentIntersection(w2.A, w2.B, w1.A, w1.B)

lineLineIntersection(w0.A, w0.B, w2.A, w2.B)
foundry.utils.lineSegmentIntersection(w0.A, w0.B, w2.A, w2.B)

pointInPolygon(poly, w0.B)
