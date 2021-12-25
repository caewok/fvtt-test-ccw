/* globals
PIXI,
*/

'use strict';

/* Additions to the PIXI.Polygon class:
- iteratePoints: iterator for the polygon points.
- signedArea: Area of the polygon
- isClockwise: Are the points in clockwise or counterclockwise order?
- reverse: Reverse point order
- getBounds: Bounding rectangle for the polygon
- getCenter: Center of the rectangle, based on its bounding rectangle center.
- scale: change each point by (pt - position) / size
- unscale: change each point by (pt * size) + position
*/

/**
 * Iterate over the polygon's {x, y} points in order.
 * Note: last two this.points (n-1, n) equal the first (0, 1)
 * @return {x, y} PIXI.Point
 */ 
function* iteratePoints(close = true) {
  const dropped = close ? 0 : 2;
  for(let i = 0; i < (this.points.length - dropped); i += 2) {
    yield new PIXI.Point(this.points[i], this.points[i + 1]);
  }
}



/**
 * Test if the points are in clockwise or counterclockwise order.
 * https://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-points-are-in-clockwise-order
 * @return {boolean} True if the points are in clockwise order
 */ 
function signedArea() {
  let the_sum = 0;
  const pts = this.points;
  const ln = pts.length - 2;
  
  let prev_pt = { x: pts[0], y: pts[1] };
  for(let i = 2; i < ln; i += 2) {
    const pt = { x: pts[i], y: pts[i + 1]}
    the_sum += (prev_pt.x * pt.y - pt.x * prev_pt.y);
    prev_pt = pt;
  }
  return the_sum / 2;
}

function isClockwise() {
  return this.signedArea() > 0;
}

/**
 * Reverse the order of the polygon points.
 */
function reverse() {
  const reversed_pts = [];
  const pts = this.points;
  const ln = pts.length - 2;
  for(let i = ln; i >= 0; i -= 2) {
    reversed_pts.push(pts[i], pts[i + 1]);
  }
  this.points = reversed_pts;
}

/**
 * Returns the framing rectangle of the polygon as a Rectangle object
 * Comparable to PIXI.Circle.getBounds().
 * @return {PIXI.Rectangle}
 */
function getBounds() {
  const iter = this.iteratePoints(false);
  const bounds = [...iter].reduce((prev, pt) => {
    return {
      min_x: Math.min(pt.x, prev.min_x),
      min_y: Math.min(pt.y, prev.min_y),
      max_x: Math.max(pt.x, prev.max_x),
      max_y: Math.max(pt.y, prev.max_y) };
  
  }, { min_x: Number.POSITIVE_INFINITY, max_x: Number.NEGATIVE_INFINITY, 
       min_y: Number.POSITIVE_INFINITY, max_y: Number.NEGATIVE_INFINITY });
  
  return new PIXI.Rectangle(bounds.min_x, bounds.min_y, 
                            bounds.max_x - bounds.min_x,
                            bounds.max_y - bounds.min_y);     
}

/**
 * Locate the center of the polygon, defined as the center of its bounding rectangle
 * @return {Point}
 */
function getCenter() {
  const rect = this.getBounds();
  return rect.getCenter();
}

/**
 * Scale a polygon by shifting its position and size.
 * Each point will be changed by the formula:
 * pt.x = (pt.x - position_dx) / size_dx;
 * pt.y = (pt.y - position_dy) / size_dy;
 * Typically, dx and dy are the same. Providing different dx and dy 
 * will warp the polygon shape accordingly.
 * Default values will not change the points.
 * 
 * Useful for enlarging or shrinking a polygon, such as an approximate circle.
 * 
 * @param {number} position_dx
 * @param {number} position_dy
 * @param {number} size_dx
 * @param {number} size_dy
 */
function scale({ position_dx = 0, position_dy = 0, size_dx = 1, size_dy = 1} = {}) {
  const pts = this.points;
  const ln = pts.length;
  for(let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] - position_dx) / size_dx;
    pts[i+1] = (pts[i+1] - position_dy) / size_dy;
  }
}

/**
 * Unscale a polygon by shifting its position and size (opposite of scale).
 * Each point will be changed by the formula:
 * pt.x = (pt.x * size_dx) + position_dx;
 * pt.y = (pt.y * size_dy) + position_dy;
 * Typically, dx and dy are the same. Providing different dx and dy 
 * will warp the polygon shape accordingly.
 * Default values will not change the points.
 * 
 * Useful for enlarging or shrinking a polygon, such as an approximate circle.
 * 
 * @param {number} position_dx
 * @param {number} position_dy
 * @param {number} size_dx
 * @param {number} size_dy
 */
function unscale({ position_dx = 0, position_dy = 0, size_dx = 1, size_dy = 1 } = {}) {
  const pts = this.points;
  const ln = pts.length;
  for(let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] * size_dx) + position_dx;
    pts[i+1] = (pts[i+1] * size_dy) + position_dy;
  }
}

// ----------------  ADD METHODS TO THE PIXI.POLYGON PROTOTYPE --------------------------
export function registerPIXIPolygonMethods() {

  Object.defineProperty(PIXI.Polygon.prototype, "iteratePoints", {
    value: iteratePoints,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "signedArea", {
    value: signedArea,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "isClockwise", {
    value: isClockwise,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "reverse", {
    value: reverse,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "getBounds", {
    value: getBounds,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "getCenter", {
    value: getCenter,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "scale", {
    value: scale,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "unscale", {
    value: unscale,
    writable: true,
    configurable: true
  });
}