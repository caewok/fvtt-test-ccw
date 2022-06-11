/* globals
PIXI,
Ray,
ClockwiseSweepPolygon,
foundry
*/

"use strict";

import { NORMALIZED_CIRCLE_POINTS_60, NORMALIZED_CIRCLE_POINTS_12 } from "./NormalizedCirclePoints.js";
import { tracePolygon } from "./trace_polygon.js";

/* Additions to the PIXI.Circle class:
- toPolygon: convert to an (approximate) PIXI.Polygon
- polygonUnion: Union this circle with a polygon
- polygonIntersect: Intersect this circle with a polygon
*/

/**
 * Convert to closed PIXI.Polygon.
 * Approximation based on ClockwiseSweepPolygon.prototype._getPaddingPoints method.
 * Ordered clockwise from due west.
 * Density 12 or 60 will re-scale cached values based on desired radius.
 * Otherwise, the points will be re-calculated.
 * Using the cached values is an order of magnitude faster.
 * @param {number} density  The desired density of padding rays, a number per PI.
 * @return {PIXI.Polygon}
 */
function toPolygon({ density = 60 } = {}) {
  const padding = density === 60 ? NORMALIZED_CIRCLE_POINTS_60
              : density === 12 ? NORMALIZED_CIRCLE_POINTS_12                   // eslint-disable-line indent
              : get360PaddingPoints(this.x, this.y, this.radius, { density }); // eslint-disable-line indent

  // Padding is in {x, y} format; convert to polygon
  let poly = new PIXI.Polygon(padding);
  if (density === 60 || density === 12) {
    // Re-scale normalized circle to desired center and radius
    /* eslint-disable indent */
    poly = poly.unscale({ position_dx: this.x,
                          position_dy: this.y,
                          size_dx: this.radius,
                          size_dy: this.radius });
    /* eslint-enable indent */
  }

  // Close the polygon
  poly.points.push(poly.points[0], poly.points[1]);

  // Circle polygons have certain qualities
  poly._isClosed = true;
  poly._isConvex = true;
  poly._isClockwise = true;

  return poly;
}


/**
 * Get the points that would trace a circular arc from one point to another
 * given a center point.
 * @param {Point}   fromPoint
 * @param {Point}   toPoint
 * @param {Point}   center
 * Optional:
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 */
function pointsForArc(fromPoint, toPoint, center, { density = 60 } = {}) {
  const obj = { config: { density }};
  const r0 = new Ray(center, fromPoint);
  const r1 = new Ray(center, toPoint);
  return ClockwiseSweepPolygon.prototype._getPaddingPoints.call(obj, r0, r1);
}

/**
 * Get a set of 360º points approximating a circle.
 * Default values are a normalized circle: origin 0, 0 with radius 1.
 * @param {Ray} r0
 * @param {number} density  The desired density of padding rays, a number per PI
 */
function get360PaddingPoints(x, y, radius, { density = 60 } = {}) {
  const r0 = Ray.fromAngle(x, y, 0, radius);
  // Trick the padding method into returning 360º of padding
  const r1 = Ray.fromAngle(x, y, -1e-06, radius);
  const obj = { config: { density }};
  return ClockwiseSweepPolygon.prototype._getPaddingPoints.call(obj, r0, r1);
}

/**
 * Translate a circle, shifting it in the x and y direction.
 * (Basic but useful b/c it is equivalent to polygon.translate)
 * @param {Number} delta_x  Movement in the x direction.
 * @param {Number} delta_y  Movement in the y direction.
 * @return {PIXI.Circle}  New circle object.
 */
function translate(delta_x, delta_y) {
  return new this.constructor(this.x + delta_x, this.y + delta_y, this.radius);
}

/**
 * Union this circle with a polygon
 * Generally faster than using clipper to process the circle as a polygon.
 * @param {PIXI.Polygon} poly
 * Optional:
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 * @return {PIXI.Polygon}
 */
function unionPolygon(poly, { density = 60 } = {}) {
  return tracePolygon(poly, this, { union: true, density });
}

/**
 * Intersect this circle with a polygon
 * Generally faster than using clipper to process the circle as a polygon.
 * @param {PIXI.Polygon} poly
 * Optional:
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 * @return {PIXI.Polygon}
 */
function intersectPolygon(poly, { density = 60 } = {}) {
  return tracePolygon(poly, this, { union: false, density });
}

/**
 * Intersect this circle with another circle
 * @param {PIXI.Circle} other
 * Optional:
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 * @return {PIXI.Polygon|Point|null}
 */
function unionCircle(other, { density = 60 } = {}) {
  return circleCircle(this, other, { union: true, density });
}

/**
 * Union this circle with another circle
 * @param {PIXI.Circle} other
 * Optional:
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 * @return {PIXI.Polygon|PIXI.Circle[]}
 */
function intersectCircle(other, { density = 60 } = {}) {
  return circleCircle(this, other, { union: false, density });
}

/**
 * Construct the union or intersect of two circles.
 * @param {PIXI.Circle} red
 * @param {PIXI.Circle} black
 * Optional:
 * @param {Boolean} union   True for union; false for intersect.
 * @param {Number}  density   How many points to use in the arc if it traced a whole circle.
 * @return {PIXI.Polygon|Point|null} (intersection) or {PIXI.Polygon|PIXI.Circle[]} (union)
 *   Return depends on intersections found:
 *    Num IX  Union         Intersect
 *    0       [red, black]  null
 *    1       [red, black]  Point (ix)
 *    2       PIXI.Polygon  PIXI.Polygon
 */
function circleCircle(red, black, { union = true, density = 60 } = {}) {
  // Circles can intersect nowhere, once (tangent) or twice
  const ixs = findCircleCircleIntersections(red, black);
  if ( !ixs.length ) { return union ? [red, black] : null; }

  if ( ixs.length === 1 ) {
    return union ? [red, black] : ixs[0];
  }

  // Two intersections. Draw the arcs between the intersections ---
  // either the outside or the inside circles for union/intersection respectively.
  const orient0 = foundry.utils.orient2dFast(this.shape, this.other, ixs[0]);
  const orient1 = foundry.utils.orient2dFast(this.shape, this.other, ixs[1]);

  let s0;
  let s1;
  if ( union ) {
    s0 = orient0 > 0 ? this.other : this.shape;
    s1 = orient1 > 0 ? this.other : this.shape;

  } else { // Intersection
    s0 = orient0 > 0 ? this.shape : this.other;
    s1 = orient1 > 0 ? this.shape: this.other;
  }

  const pts = [ixs[0]];
  pts.push(pointsForArc(ixs[0], ixs[1], s0, { density }));
  pts.push(pointsForArc(ixs[1], ixs[0], s1, { density }));
  pts.push(ixs[1]);

  return new PIXI.Polygon(pts);
}

/**
 * http://math.stackexchange.com/a/1367732
 * @param {PIXI.Circle}   red
 * @param {PIXI.Circle}   black
 * @param {Point[]}       0, 1, or 2 points of intersection.
 */
function findCircleCircleIntersections(red, black) {
  const x1 = red.x;
  const y1 = red.y;
  const r1 = red.radius;
  const r1_2 = Math.pow(r1, 2);

  const x2 = black.x;
  const y2 = black.y;
  const r2 = black.radius;

  const dx = x1 - x2;
  const dy = y1 - y2;

  const d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  const l = (r1_2 - Math.pow(r2, 2) + Math.pow(d, 2)) / (2 * d);
  const h = Math.sqrt(r1_2 - Math.pow(l, 2));

  if ( d === 0 ) { return []; }

  const ld = l / d;
  const hd = h / d;
  const dx2 = x2 - x1;
  const dy2 = y2 - y1;

  const out1 = { x: (ld * dx2) + (hd * dy2) + x1, y: (ld * dy2) - (hd * dx2) + y1 };
  const out2 = { x: (ld * dx2) - (hd * dy2) + x1, y: (ld * dy2) + (hd * dx2) + y1 };

  if ( out1.x.almostEqual(out2.x) && out1.y.almostEqual(out2.y) ) {
    return [out1];
  }

  return [out1, out2];
}


// ----------------  ADD METHODS TO THE PIXI.CIRCLE PROTOTYPE ------------------------
export function registerPIXICircleMethods() {
//   Object.defineProperty(PIXI.Circle.prototype, "toPolygon", {
//     value: toPolygon,
//     writable: true,
//     configurable: true
//   });

  Object.defineProperty(PIXI.Circle.prototype, "unionPolygon", {
    value: unionPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "intersectPolygon", {
    value: intersectPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "unionCircle", {
    value: unionCircle,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "intersectCircle", {
    value: intersectCircle,
    writable: true,
    configurable: true
  });


  // Static method
  Object.defineProperty(PIXI.Circle, "pointsForArc", {
    value: pointsForArc,
    writable: true,
    configurable: true
  });

  // For equivalence with a PIXI.Polygon
  Object.defineProperty(PIXI.Circle.prototype, "isClosed", {
    get: () => true
  });

  Object.defineProperty(PIXI.Circle.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });
}
