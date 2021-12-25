/* globals
PIXI,
Ray,
*/

'use strict';

import { NORMALIZED_CIRCLE_POINTS_60, 
         NORMALIZED_CIRCLE_POINTS_12 } from "./NormalizedCirclePoints.js";

/* Additions to the PIXI.Circle class:
- toPolygon: convert to an (approximate) PIXI.Polygon
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
function toPolygon(density = 60) {
  const pts = density === 60 ? NORMALIZED_CIRCLE_POINTS_60 : 
              density === 12 ? NORMALIZED_CIRCLE_POINTS_12 : 
                getPaddingPoints(new Ray( { x: this.x, y: this.y },
                                          { x: this.x - this.radius, y: this.y }), 
                                          density);

  const poly = new PIXI.Polygon(pts);
  
  if(density === 60 || density === 12) {
    // re-scale normalized circle to desired center and radius
    poly.unscale({ position_dx: this.x, 
                   position_dy: this.y,
                   size_dx: this.radius,
                   size_dy: this.radius });
  }
  
  return poly;
}

/**
 * Get a set of 360º points approximating a circle.
 * Default values are a normalized circle: origin 0, 0 with radius 1.
 * @param {Ray} r0
 * @param {number} density  The desired density of padding rays, a number per PI
 */
function getPaddingPoints(r0 = new Ray( {x: 0, y: 0}, {x:-1, y: 0} ), density = 60) {
      density = Math.PI / density;
      const padding = [];
      const d = 2 * Math.PI;
      const nPad = Math.round(d / density);
      
      const delta = d / nPad;
      for ( let i=1; i<nPad; i++ ) {
        const p = r0.shiftAngle(i * delta);
        padding.push(p.B);
      }
      return padding;
    }

// ----------------  ADD METHODS TO THE PIXI.CIRCLE PROTOTYPE ------------------------
export function registerPIXICircleMethods() {
  Object.defineProperty(PIXI.Circle.prototype, "toPolygon", {
    value: toPolygon,
    writable: true,
    configurable: true
  });
}
