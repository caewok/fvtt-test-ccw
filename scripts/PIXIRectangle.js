/* globals
PIXI,
foundry
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
  
  if((p.x > this.x && p.x < this.right) ||
     p.x.almostEqual(this.x, e) || 
     p.x.almostEqual(this.right, e)) {
    if((p.y > this.y && p.y < this.bottom) ||
       p.y.almostEqual(this.y, e) || 
       p.y.almostEqual(this.bottom, e)) {
      return true;    
    }
  }
  return false;
} 

/**
 * Pad rectangle to contain given point
 * @param {Point} p
 */
function padToPoint(p) {
  const horiz = Math.max(0, p.x > this.x ? (p.x - this.right) : (this.x - p.x));
  const vert =  Math.max(0, p.y > this.y ? (p.y - this.bottom) : (this.y - p.y));
  this.pad(horiz, vert);
}

//   const horiz = Math.max(0, p.x > rect.x ? (p.x - rect.right) : (rect.x - p.x));
//   const vert =  Math.max(0, p.y > rect.y ? (p.y - rect.bottom) : (rect.y - p.y));
//   this.pad(horiz, vert);

/**
 * Helper methods to track whether a segment intersects an edge.
 */
function _intersectsTop(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b, 
                                             { x: this.x, y: this.y },
                                             { x: this.right, y: this.y });
}

function _intersectsRight(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b, 
                                             { x: this.right, y: this.y },
                                             { x: this.right, y: this.bottom });
}

function _intersectsBottom(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b, 
                                             { x: this.right, y: this.bottom },
                                             { x: this.x, y: this.bottom });
}

function _intersectsLeft(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b, 
                                             { x: this.x, y: this.bottom },
                                             { x: this.x, y: this.y });
}

/**
 * Split outside of rectangle into 8 zones by extending the rectangle edges indefinitely.
 * Zone is 1–8 starting at northwest corner, moving clockwise around rectangle.
 * containsPoint === true is zone 0
 * Determine in which zone a point falls.
 * @param {Point} p
 * @return {number} 0–9
 */
function _zone(p) {
  if(this.containsPoint(p)) return 0;
  
  if(p.x < this.x) {
    // zones 1, 8, 7
    return p.y < this.y ? 1 :
           p.y > this.bottom ? 7 : 
           8;
  } else if(p.x > this.right) {
    // zones 3, 4, 5
    return p.y < this.y ? 3 :
           p.y > this.bottom ? 5 :
           4;
  } else {
    // x is within rectangle bounds; zones 2, 6
    return p.y < this.y ? 2 : 6; 
  }
}

function lineSegmentIntersects(a, b) {
  const zone_a = this._zone(a);
  const zone_b = this._zone(b);
  if(!zone_a && !zone_b) return false; // both points inside
  if(zone_a === 0 || zone_b === 0) return true; // one point inside, one outside

  // checking every zone combination is complicated 
  // and does not give a huge speed increase.
  // instead, check the easy ones.
  
  // points outside && a is on a corner:
  if((zone_a === 1) &&
     (zone_b === 1 || zone_b === 2 || zone_b === 3 ||
      zone_b === 7 || zone_b === 8)) return false;

  if((zone_a === 3) &&
     (zone_b === 1 || zone_b === 2 || zone_b === 3 ||
      zone_b === 4 || zone_b === 5)) return false;

  if((zone_a === 5) &&
     (zone_b === 3 || zone_b === 4 || zone_b === 5 ||
      zone_b === 6 || zone_b === 7)) return false;

  if((zone_a === 7) &&
     (zone_b === 5 || zone_b === 6 || zone_b === 7 ||
      zone_b === 8 || zone_b === 1)) return false;
  
  // points outside && on same side of rectangle:
  if((zone_a === 1 || zone_a === 2 || zone_a === 3) &&
     (zone_b === 1 || zone_b === 2 || zone_b === 3)) return false;
     
  if((zone_a === 3 || zone_a === 4 || zone_a === 5) &&
     (zone_b === 3 || zone_b === 4 || zone_b === 5)) return false;

  if((zone_a === 5 || zone_a === 6 || zone_a === 7) &&
     (zone_b === 5 || zone_b === 6 || zone_b === 7)) return false;
  
  if((zone_a === 7 || zone_a === 8 || zone_a === 1) &&
     (zone_b === 7 || zone_b === 8 || zone_b === 1)) return false;


  // could just do this and skip the above; but it is a bit faster
  // to check some of the easy cases above first.
  return this._intersectsTop(a, b)    || 
       this._intersectsRight(a, b)  ||
       this._intersectsBottom(a, b) ||
       this._intersectsLeft(a, b);
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
  
  Object.defineProperty(PIXI.Rectangle.prototype, "padToPoint", {
    value: padToPoint,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Rectangle.prototype, "lineSegmentIntersects", {
    value: lineSegmentIntersects,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsTop", {
    value: _intersectsTop,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsBottom", {
    value: _intersectsBottom,
    writable: true,
    configurable: true
  });  
  
  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsLeft", {
    value: _intersectsLeft,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsRight", {
    value: _intersectsRight,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Rectangle.prototype, "_zone", {
    value: _zone,
    writable: true,
    configurable: true
  });       
}
