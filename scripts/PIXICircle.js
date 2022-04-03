/* globals
PIXI,
Ray,
ClockwiseSweepPolygon
*/

'use strict';

import { NORMALIZED_CIRCLE_POINTS_60,
         NORMALIZED_CIRCLE_POINTS_12 } from "./NormalizedCirclePoints.js";

import { circle_union, circle_intersect } from "./CirclePolygonCombine.js";

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
  const padding = density === 60 ? NORMALIZED_CIRCLE_POINTS_60 :
              density === 12 ? NORMALIZED_CIRCLE_POINTS_12 :
              get360PaddingPoints(this.x, this.y, this.radius, { density });

  // padding is in {x, y} format; convert to polygon
  let poly = PIXI.Polygon.fromPoints(padding);
  if(density === 60 || density === 12) {
    // re-scale normalized circle to desired center and radius
    poly = poly.unscale({ position_dx: this.x,
                   position_dy: this.y,
                   size_dx: this.radius,
                   size_dy: this.radius });
  }

  // close the polygon
  poly.points.push(poly.points[0], poly.points[1])

  // circle polygons have certain qualities
  poly._isClosed = true;
  poly._isConvex = true;
  poly._isClockwise = true;

  return poly;
}

/**
 * Get a set of 360º points approximating a circle.
 * Default values are a normalized circle: origin 0, 0 with radius 1.
 * @param {Ray} r0
 * @param {number} density  The desired density of padding rays, a number per PI
 */
function get360PaddingPoints(x, y, radius, { density = 60 } = {}) {
  const r0 = Ray.fromAngle(x, y, 0, radius);
  // trick padding method to return 360º of padding
  const r1 = Ray.fromAngle(x, y, -1e-06, radius)
  const obj = { config: { density }};
  return ClockwiseSweepPolygon.prototype._getPaddingPoints.call(obj, r0, r1);
}

// ----------------  ADD METHODS TO THE PIXI.CIRCLE PROTOTYPE ------------------------
export function registerPIXICircleMethods() {
  Object.defineProperty(PIXI.Circle.prototype, "toPolygon", {
    value: toPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "polygonUnion", {
    value: circle_union,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "polygonIntersect", {
    value: circle_intersect,
    writable: true,
    configurable: true
  });

  // For equivalence with a PIXI.Polygon
  Object.defineProperty(PIXI.Circle.prototype, "isClosed", {
    get: () => true,
  });
}
