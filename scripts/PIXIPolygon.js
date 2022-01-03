/* globals
PIXI,
foundry,
ClipperLib,
*/

'use strict';

/* Additions to the PIXI.Polygon class:
Getters:
- isClosed: Are the points closed (first and last points are same)?
- isConvex: Is the polygon convex?
- isClockwise: Are the points in clockwise or counterclockwise order?

Generators:
- iteratePoints: iterator for the polygon points.

Methods:
- close: Close the polygon (if not already)
- reverse: Reverse point order
- getBounds: Bounding rectangle for the polygon
- getCenter: Center of the polygon, based on its bounding rectangle center.
- scale: change each point by (pt - position) / size and return new polygon
- unscale: change each point by (pt * size) + position and return new polygon

Static methods:
- fromPoints: Construct from array of {x, y} points.

Helper methods:
- determineConvexity: Measure if the polygon is convex.
- determineOrientation: Measure the orientation of the polygon
*/

function fromPoints(points) {
  const out = new this(points.flatMap(pt => [pt.x, pt.y]));
  out.close()
  return out;
}

/**
 * Iterate over the polygon's {x, y} points in order.
 * Note: last two this.points (n-1, n) equal the first (0, 1)
 * @return {x, y} PIXI.Point
 */ 
function* iteratePoints({close = true} = {}) {
  const dropped = (!this.isClosed || close) ? 0 : 2;
  for(let i = 0; i < (this.points.length - dropped); i += 2) {
    yield new PIXI.Point(this.points[i], this.points[i + 1]);
  }
}

/**
 * Getter to store the coordinate point set.
 */
function coordinates() {
  return this._coordinates || 
         (this._coordinates = [...this.iteratePoints({close: false})]);
}

/**
 * Is the polygon open or closed?
 * @return {boolean}  True if closed.
 */
function isClosed() {
  if(typeof this._isClosed === "undefined") {
    const ln = this.points.length;
    this._isClosed = this.points[0].almostEqual(this.points[ln - 2]) && 
                     this.points[1].almostEqual(this.points[ln - 1])
  }
  return this._isClosed;
}

/**
 * Close the polygon by adding the first point to the end
 */
function close() {
  if(this.isClosed) return;
  this.points.push(this.points[0], this.points[1]);
  this._isClosed = true;
}

/**
 * Is the polygon convex?
 * https://stackoverflow.com/questions/40738013/how-to-determine-the-type-of-polygon
 * If you already know the polygon convexity, you should set this._isConvex manually.
 */
function isConvex() {
  if(typeof this._isConvex === "undefined") {
    this._isConvex = this.determineConvexity()
  }
  return this._isConvex;
}


/**
 * Measure the polygon convexity
 * https://stackoverflow.com/questions/40738013/how-to-determine-the-type-of-polygon
 * Check sign of the cross product for triplet points. 
 * Must all be +  or all - to be convex.
 * WARNING: Will not work if the polygon is complex 
 * (meaning it intersects itself, forming 2+ smaller polygons)
 */
function determineConvexity() {
  if(!this.isClosed) {
    console.warn(`Convexity is not defined for open polygons.`);
    return false;
  }
  
  // if a closed triangle, then always convex (2 coords / pt * 3 pts + repeated pt)
  if(this.points.length === 8) return true;

  const iter = this.iteratePoints();
  let prev_pt = iter.next().value;
  let curr_pt = iter.next().value;
  let next_pt = iter.next().value;
  let new_pt;
  
  const sign = Math.sign(foundry.utils.orient2dFast(prev_pt, curr_pt, next_pt));
  
  // if polygon is a triangle, while loop should be skipped and will always return true
  while( (new_pt = iter.next().value) ) {
    prev_pt = curr_pt;
    curr_pt = next_pt;
    next_pt = new_pt;
    const new_sign = Math.sign(foundry.utils.orient2dFast(prev_pt, curr_pt, next_pt));
    
    if(sign !== new_sign) return false;
  }
  return true; 
}

function isClockwise() {
  if(typeof this._isClockwise === "undefined") {
    // recall that orient2dFast returns positive value if points are ccw
    this._isClockwise = this.determineOrientation() < 0;
  }
  return this._isClockwise;
}

/**
 * Determine if the polygon points are oriented clockwise or counter-clockwise
 * https://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
 * Locate a point on the convex hull, and find its orientation in relation to the
 * prior point and next point.
 */
function determineOrientation() {
  if(this.isConvex) {
    // can use any point to determine orientation
    const iter = this.iteratePoints();
    const prev_pt = iter.next().value;
    const curr_pt = iter.next().value;
    const next_pt = iter.next().value;
    return foundry.utils.orient2dFast(prev_pt, curr_pt, next_pt);
  } 
  
  // locate the index of the vertex with the smallest x coordinate. 
  // Break ties with smallest y
  const pts = this.points;
  const ln = this.isClosed ? pts.length - 2 : pts.length; // don't repeat the first point
  let min_x = Number.POSITIVE_INFINITY;
  let min_y = Number.POSITIVE_INFINITY;
  let min_i = 0;
  for(let i = 0; i < ln; i += 2) {
    const curr_x = pts[i];
    const curr_y = pts[i+1];
    
    if(curr_x < min_x || (curr_x === min_x && curr_y < min_y)) {
      min_x = curr_x;
      min_y = curr_y;
      min_i = i;    
    } 
  }
  
  // min_x, min_y are the B (the point on the convex hull)
  const curr_pt = { x: min_x, y: min_y };
  
  const prev_i = min_i > 1 ? (min_i - 2) : (ln - 2);
  const prev_pt = { x: pts[prev_i], y: pts[prev_i + 1] };
  
  const next_i = min_i < (ln - 2) ? (min_i + 2) : 0;
  const next_pt = { x: pts[next_i], y: pts[next_i + 1] };
  
  return foundry.utils.orient2dFast(prev_pt, curr_pt, next_pt);
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
  if(typeof this._isClockwise !== "undefined") {
    this._isClockwise = !this._isClockwise;
  }
}

/**
 * Returns the framing rectangle of the polygon as a Rectangle object
 * Comparable to PIXI.Circle.getBounds().
 * @return {PIXI.Rectangle}
 */
function getBounds() {
  const iter = this.iteratePoints({ close: false });
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
 * @return {Array[number]} The scaled points
 */
function scale({ position_dx = 0, position_dy = 0, size_dx = 1, size_dy = 1} = {}) {
  const pts = [...this.points];
  const ln = pts.length;
  for(let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] - position_dx) / size_dx;
    pts[i+1] = (pts[i+1] - position_dy) / size_dy;
  }
  
  const out = new this.constructor(pts);
  out._isClockwise = this._isClockwise;
  out._isConvex = this._isConvex;
  out._isClosed = this._isClosed;
  
  return out;
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
 * @return {PIXI.Polygon} A new PIXI.Polygon
 */
function unscale({ position_dx = 0, position_dy = 0, size_dx = 1, size_dy = 1 } = {}) {
  const pts = [...this.points];
  const ln = pts.length;
  for(let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] * size_dx) + position_dx;
    pts[i+1] = (pts[i+1] * size_dy) + position_dy;
  }
  
  const out = new this.constructor(pts);
  out._isClockwise = this._isClockwise;
  out._isConvex = this._isConvex;
  out._isClosed = this._isClosed;
  
  return out;
}

// 




// ---------------- Clipper JS library ---------------------------------------------------

/**
 * getter to store clipper points


/**
 * Transform array of X, Y points to a PIXI.Polygon
 */
function fromClipperPoints(points) {
  const out = new this(points.flatMap(pt => [pt.X, pt.Y]));
  out.close();
  return out;
}

/**
 * Iterate over the polygon's {x, y} points in order.
 * Return in ClipperLib format: {X, Y}
 * @return {x, y} PIXI.Point
 */
function* iterateClipperLibPoints({close = true} = {}) {
  const dropped = (!this.isClosed || close) ? 0 : 2;
  for(let i = 0; i < (this.points.length - dropped); i += 2) {
    yield {X: this.points[i], Y: this.points[i + 1]};
  }
} 

/**
 * Getter to store the clipper coordinate point set.
 */
function clipperCoordinates() {
  return this._clipperCoordinates || 
         (this._clipperCoordinates = [...this.iterateClipperLibPoints({close: false})]);
}

/**
 * Point contained in polygon
 * Returns 0 if false, -1 if pt is on poly and +1 if pt is in poly.
 */
function clipperContains(pt) {
  const path = this.clipperCoordinates;
  
  return ClipperLib.Clipper.PointInPolygon(new ClipperLib.FPoint(pt.x, pt.y), path);
}

/**
 * Are the polygon points oriented clockwise?
 */
function clipperIsClockwise() {
  const path = this.clipperCoordinates;
  return ClipperLib.Clipper.Orientation(path); 
}

/**
 * Get bounding box
 */
function clipperBounds() {
  const path = this.clipperCoordinates;
  const bounds = ClipperLib.JS.BoundsOfPath(path); // returns ClipperLib.FRect
  
  return new PIXI.Rectangle(bounds.left, 
                              bounds.top, 
                              bounds.right - bounds.left, 
                              bounds.bottom - bounds.top);
}

/**
 * Clip a polygon with another.
 * Union, Intersect, diff, x-or
 */
function clipperClip(poly, { cliptype = ClipperLib.ClipType.ctUnion } = {}) {
  const subj = this.clipperCoordinates;
  const clip = poly.clipperCoordinates;

  const solution = new ClipperLib.Paths();
  const c = new ClipperLib.Clipper();
  c.AddPath(subj, ClipperLib.PolyType.ptSubject, true) // true to be considered closed
  c.AddPath(clip, ClipperLib.PolyType.ptClip, true)
  c.Execute(cliptype, solution);
  
  return PIXI.Polygon.fromClipperPoints(solution[0]);
}



// ----------------  ADD METHODS TO THE PIXI.POLYGON PROTOTYPE --------------------------
export function registerPIXIPolygonMethods() {
  Object.defineProperty(PIXI.Polygon, "fromPoints", {
    value: fromPoints,
    writable: true,
    configurable: true
  });  

  Object.defineProperty(PIXI.Polygon.prototype, "iteratePoints", {
    value: iteratePoints,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Polygon.prototype, "coordinates", {
    get: coordinates,
  });
  
  Object.defineProperty(PIXI.Polygon.prototype, "isClosed", {
    get: isClosed,
  });
  

  Object.defineProperty(PIXI.Polygon.prototype, "isConvex", {
    get: isConvex,
  });

  Object.defineProperty(PIXI.Polygon.prototype, "isClockwise", {
    get: isClockwise,
  });
  
  Object.defineProperty(PIXI.Polygon.prototype, "determineConvexity", {
    value: determineConvexity,
    writable: true,
    configurable: true
  }); 

  Object.defineProperty(PIXI.Polygon.prototype, "determineOrientation", {
    value: determineOrientation,
    writable: true,
    configurable: true
  });   

  Object.defineProperty(PIXI.Polygon.prototype, "close", {
    value: close,
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
  

// ----------------  CLIPPER LIBRARY METHODS ------------------------
  
  Object.defineProperty(PIXI.Polygon.prototype, "iterateClipperLibPoints", {
    value: iterateClipperLibPoints,
    writable: true,
    configurable: true
  });  
  
  Object.defineProperty(PIXI.Polygon.prototype, "clipperCoordinates", {
    get: clipperCoordinates,
  });
  
  Object.defineProperty(PIXI.Polygon, "fromClipperPoints", {
    value: fromClipperPoints,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "clipperIsClockwise", {
    value: clipperIsClockwise,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "clipperBounds", {
    value: clipperBounds,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "clipperClip", {
    value: clipperClip,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(PIXI.Polygon.prototype, "clipperContains", {
    value: clipperContains,
    writable: true,
    configurable: true
  });
  
  
}