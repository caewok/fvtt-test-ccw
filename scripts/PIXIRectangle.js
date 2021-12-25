/* globals
PIXI,
*/

'use strict';

/* Additions to the PIXI.Rectangle class:
- getCenter: center point of the rectangle
- toPolygon: convert to a PIXI.Polygon
- containsPoint: if the point is within epsilon of the rectangle, return true
*/

// reminder:
// bottom = y + height
// right = x + width

/**
 * Locate the center of the rectangle
 * @return {Point}
 */
function getCenter() {
  return new PIXI.Point(this.x + (this.width / 2), this.y + (this.height / 2));
}

/**
 * Convert to closed PIXI.Polygon, where each corner is a vertex.
 * Ordered clockwise from top left corner.
 * @return {PIXI.Polygon}
 */
function toPolygon() {
  return new PIXI.Polygon(this.x, this.y, 
                          this.right, this.y, 
                          this.right, this.bottom,
                          this.x, this.bottom,
                          this.x, this.y)
}

/**
 * Is this point contained by the rectangle?
 * Default PIXI.Rectangle.prototype.contains is problematic, in that it just compares
 * using "<", so points on the west and south edges are not included and points very
 * near an edge may or may not be included.
 * @param {Point} p
 * @param {number} e  Some permitted epsilon, by default 1e-8
 * @returns {boolean} Is the point contained by or on the edge of the rectangle?
 */
function containsPoint(p, e = 1e-8) {
  // follow how contains method handles this
  if(this.width <= 0 || this.height <= 0) { return false; }
  
  if(p.x.almostEqual(this.x, e) || 
     p.x.almostEqual(this.right, e) ||
     (p.x > this.x && p.x < this.right)) {
    if(p.y.almostEqual(this.y, e) || 
       p.y.almostEqual(this.bottom, e) ||
       (p.y > this.y && p.y < this.bottom)) {
      return true;    
       }
  }
  return false;
} 

// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------
export function registerPIXIRectangleMethods() {

  Object.defineProperty(PIXI.Rectangle.prototype, "getCenter", {
    value: getCenter,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "toPolygon", {
    value: toPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "containsPoint", {
    value: containsPoint,
    writable: true,
    configurable: true
  });
}
