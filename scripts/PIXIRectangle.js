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
 * Does the line segment intersect this rectangle?
 * @param {Point} a   Endpoint a of the line.
 * @param {Point} b   Endpoint b of the line.
 * @return {boolean}  True if the segment intersects.
 */
function lineSegmentIntersects(a, b) {

  // check intersection of segment with each rectangle edge
  return this._intersectsTop(a, b)    || 
         this._intersectsRight(a, b)  ||
         this._intersectsBottom(a, b) ||
         this._intersectsLeft(a, b);
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

function lineSegmentIntersects2(a, b) {
  const zone_a = this._zone(a);
  const zone_b = this._zone(b);
  if(!zone_a && !zone_b) return false; // both points inside
  if(zone_a === 0 || zone_b === 0) return true; // one point inside, one outside
  
  // some combinations cannot intersect the rectangle
  // otherwise, for each zone, limited number of edges to test for the first intersection
  // (may be a second intersection if the segment is long enough, but we don't care)
  if(zone_a % 2 === 0) { return this._adjacentZoneIntersects(zone_a, zone_b, a, b); }
  
  return this._diagonalZoneIntersects(zone_a, zone_b, a, b);
}

/**
 * Testing intersection helper.
 * Option 1: one of the points is in a diagonal (odd-numbered) zone 
 * (northwest, northeast, southwest, southeast)
 */
function _diagonalZoneIntersects(zone_a, zone_b, a, b) {
  if(zone_b === 0) return true;

  // default is northwest, where zone_a is 1
  // rotate zone_b and the tests based on zone_a
  let i1 = this._intersectsLeft;
  let i2 = this._intersectsTop;
  if(zone_a === 1) {
    // empty
  } else if(zone_a === 3) { 
    // rotate 90º; adjust by 2
    zone_b = zone_b < 3 ? ( zone_b + 6 ) : ( zone_b - 2 );
    i1 = this._intersectsRight;
    
  } else if(zone_a === 5) {
    // rotate 180º; adjust by 4
    zone_b = zone_b < 5 ? ( zone_b + 4 ) : ( zone_b - 4 );    
    i1 = this._intersectsBottom;
    i2 = this._intersectsRight;
    
  } else if(zone_a === 7) {
    // rotate 270º (-90º); adjust by 6
    zone_b = zone_b < 7 ? ( zone_b + 2 ) : ( zone_b - 6 );    
    i2 = this._intersectsBottom;
    
  } else {
    console.error(`_diagonalZoneIntersects: zone not recognized.`);
  }
  
  // zone_a = NE (3)
  // zone_b = S (6)
  
  // b: 6 - 2 = 4
  
  // From default perspective of zone_a in NE.
  switch(zone_b) {
    case 0: // inside
      return true;
    case 1: // northwest zone
    case 2: // north zone
    case 3: // northeast zone
      return false;
    case 4: // east zone
    case 5: // southeast zone
    case 6: // south zone
      return i1.call(this, a, b) || i2.call(this, a, b);
    case 7: // southwest zone
    case 8: // west zone
      return false;
  }    
}

/**
 * Testing intersection helper
 * Option 2: one of the points is in an adjacent (even-numbered) zone
 * (north, south, east, west)
 */
function _adjacentZoneIntersects(zone_a, zone_b, a, b) {
  if(zone_b === 0) return true;
  
  // default is north, where zone_a is 2
  // rotate zone_b and the test based on zone_a
  let i1 = this._intersectsTop;
  if(zone_a === 2) {
    // empty
  } else if(zone_a === 4) { 
    // adjust by 2
    zone_b = zone_b < 3 ? ( zone_b + 6 ) : ( zone_b - 2 );
    i1 = this._intersectsRight;
  } else if(zone_a === 6) {
    // adjust by 4
    zone_b = zone_b < 5 ? ( zone_b + 4 ) : ( zone_b - 4 );    
    i1 = this._intersectsBottom;
  } else if(zone_a === 8) {
    // adjust by 6
    zone_b = zone_b < 7 ? ( zone_b + 2 ) : ( zone_b - 6 );   
    i1 = this._intersectsLeft; 
  } else {
    console.error(`_adjacentZoneIntersects: zone not recognized.`);
  }
  
  // From default perspective of zone_a in N
  switch(zone_b) {
    case 0: // inside
      return true;
    case 1: // northwest zone
    case 2: // north zone
    case 3: // northeast zone
      return false;
    case 4: // east zone
    case 5: // southeast zone
      return i1.call(this, a, b);
    case 6: // south zone
      return true;
    case 7: // southwest zone
    case 8: // west zone
      return i1.call(this, a, b);
  }
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
  
  Object.defineProperty(PIXI.Rectangle.prototype, "lineSegmentIntersects", {
    value: lineSegmentIntersects,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "lineSegmentIntersects2", {
    value: lineSegmentIntersects2,
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
 
  Object.defineProperty(PIXI.Rectangle.prototype, "_diagonalZoneIntersects", {
    value: _diagonalZoneIntersects,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Rectangle.prototype, "_adjacentZoneIntersects", {
    value: _adjacentZoneIntersects,
    writable: true,
    configurable: true
  });     
  
  Object.defineProperty(PIXI.Rectangle.prototype, "_zone", {
    value: _zone,
    writable: true,
    configurable: true
  });       
}
