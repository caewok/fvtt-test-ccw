/* globals
PIXI,
foundry
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
  return new this(points.flatMap(pt => [pt.x, pt.y]));
}

/**
 * Iterate over the polygon's {x, y} points in order.
 * Note: last two this.points (n-1, n) equal the first (0, 1)
 * @return {x, y} PIXI.Point
 */ 
function* iteratePoints({close = true} = {}) {
  const dropped = close ? 0 : 2;
  for(let i = 0; i < (this.points.length - dropped); i += 2) {
    yield new PIXI.Point(this.points[i], this.points[i + 1]);
  }
}


/**
 * Is the polygon open or closed?
 * @return {boolean}  True if closed.
 */
function isClosed() {
  if(typeof this._isClosed === "undefined") {
    const ln = this.points.length;
    this._isClosed = this.points[0] === this.points[ln - 2] && 
                     this.points[1] === this.points[ln - 1]
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


/**
 * From https://rosettacode.org/wiki/Sutherland-Hodgman_polygon_clipping#JavaScript
 * Sutherland-Hodgman polygon clipping
 * Finds the polygon that is the intersection between this (arbitrary) polygon 
 * (the “subject polygon”) and a convex polygon (the “clip polygon”).
 * @param {PIXI.Polygon} clipPolygon      Convex polygon used to clip. Must be convex.
 * @return {PIXI.Polygon} New polygon, intersection of subject with clipped.
 */
function clip(clipPolygon) {
  if(!clipPolygon.isConvex) { 
    console.error(`PIXI.Polygon.prototype.clip called with a non-convex polygon.`);
  }
  
//  subjectPolygon = [[50, 150], [200, 50], [350, 150], [350, 300], [250, 300], [200, 250], [150, 350], [100, 250], [100, 200]];
//  clipPolygon = [[100, 100], [300, 100], [300, 300], [100, 300]];
 
  //  subjectPolygon = new PIXI.Polygon(subjectPolygon.flat());
//    clipPolygon = new PIXI.Polygon(clipPolygon.flat());
    
  const subjectPolygon = this;
  subjectPolygon.close();
  clipPolygon.close();

  const inside = function(a, b, c) { return foundry.utils.orient2dFast(a, b, c) < 0; }
  const intersection = function(a, b, c, d) { 
    const x = foundry.utils.lineLineIntersection(a, b, c, d);
    return {x: x.x, y: x.y}
  }
  
  let outputList = [...subjectPolygon.iteratePoints({ close: false })];
  const clip_ln = clipPolygon.points.length;
  let cp1 = { x: clipPolygon.points[clip_ln - 4],
              y: clipPolygon.points[clip_ln - 3] };
  const clipIter = clipPolygon.iteratePoints({ close: false });
  for (const cp2 of clipIter) {
      const inputList = outputList;
      outputList = [];
      let s = inputList[inputList.length - 1]; //last on the input list
      for (const e of inputList) {
    
          if (inside(cp2, e, cp1)) {
              if (!inside(cp2, s, cp1)) {
                  outputList.push(intersection(cp2, cp1, e, s));
              }
              outputList.push(e);
          }
          else if (inside(cp2, s, cp1)) {
              outputList.push(intersection(cp2, cp1, e, s));
          }
          s = e;
      }
      cp1 = cp2;
  }
  
  const out = PIXI.Polygon.fromPoints(outputList);
  out.close();
  
  return out;
}




  // var cp1, cp2, s, e;
//   var inside = function (p) {
//       return (cp2[0]-cp1[0])*(p[1]-cp1[1]) > (cp2[1]-cp1[1])*(p[0]-cp1[0]);
//   };
//   var intersection = function () {
//       var dc = [ cp1[0] - cp2[0], cp1[1] - cp2[1] ],
//           dp = [ s[0] - e[0], s[1] - e[1] ],
//           n1 = cp1[0] * cp2[1] - cp1[1] * cp2[0],
//           n2 = s[0] * e[1] - s[1] * e[0], 
//           n3 = 1.0 / (dc[0] * dp[1] - dc[1] * dp[0]);
//       return [(n1*dp[0] - n2*dc[0]) * n3, (n1*dp[1] - n2*dc[1]) * n3];
//   };
//   var outputList = subjectPolygon;
//   cp1 = clipPolygon[clipPolygon.length-1];
//   for (var j in clipPolygon) {
//       cp2 = clipPolygon[j];
//       var inputList = outputList;
//       outputList = [];
//       s = inputList[inputList.length - 1]; //last on the input list
//       for (var i in inputList) {
//           e = inputList[i];
//           if (inside(e)) {
//               if (!inside(s)) {
//                   outputList.push(intersection());
//               }
//               outputList.push(e);
//           }
//           else if (inside(s)) {
//               outputList.push(intersection());
//           }
//           s = e;
//       }
//       cp1 = cp2;
//   }
//   return outputList




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
  
  Object.defineProperty(PIXI.Polygon.prototype, "clip", {
    value: clip,
    writable: true,
    configurable: true
  });
}