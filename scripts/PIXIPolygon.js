/* globals
PIXI,
ClipperLib
*/

"use strict";


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

Helper methods:
- determineConvexity: Measure if the polygon is convex.
- determineOrientation: Measure the orientation of the polygon
*/


/**
 * Is the polygon open or closed?
 * @return {boolean}  True if closed.
 */
function isClosed() {
  if (typeof this._isClosed === "undefined") {
    const ln = this.points.length;
    if (ln < 2) return undefined;

    this._isClosed = this.points[0].almostEqual(this.points[ln - 2])
                  && this.points[1].almostEqual(this.points[ln - 1]);
  }
  return this._isClosed;
}

/**
 * Close the polygon by adding the first point to the end.
 */
function close() {
  if (typeof this.isClosed === "undefined" || this.isClosed) return;
  this.points.push(this.points[0], this.points[1]);
  this._isClosed = true;
}

/**
 * Intersect another polygon
 */
function intersectPolygon(other) {
  return this.clipperClip(other, { cliptype: ClipperLib.ClipType.ctIntersection });
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
  c.AddPath(subj, ClipperLib.PolyType.ptSubject, true); // True to be considered closed
  c.AddPath(clip, ClipperLib.PolyType.ptClip, true);
  c.Execute(cliptype, solution);

  return PIXI.Polygon.fromClipperPoints(solution[0]);
}

/**
 * Getter to store the clipper coordinate point set.
 */
function clipperCoordinates() {
  return [...this.iterateClipperLibPoints({close: false})];
}

/**
 * Iterate over the polygon's {x, y} points in order.
 * Return in ClipperLib format: {X, Y}
 * @return {x, y} PIXI.Point
 */
function* iterateClipperLibPoints({close = true} = {}) {
  const dropped = (!this.isClosed || close) ? 0 : 2;
  for (let i = 0; i < (this.points.length - dropped); i += 2) {
    yield {X: this.points[i], Y: this.points[i + 1]};
  }
}

/**
 * Transform array of X, Y points to a PIXI.Polygon
 */
function fromClipperPoints(points) {
  // Flat map is slow: const out = new this(points.flatMap(pt => [pt.X, pt.Y]));
  // Switch to for loop. https://jsbench.me/eeky2ei5rw
  const pts = [];
  for (const pt of points) {
    pts.push(pt.X, pt.Y);
  }
  const out = new this(...pts);

  out.close();
  return out;
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
  for (let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] - position_dx) / size_dx;   // eslint-disable-line no-multi-spaces
    pts[i+1] = (pts[i+1] - position_dy) / size_dy;
  }

  const out = new this.constructor(pts);
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
  for (let i = 0; i < ln; i += 2) {
    pts[i]   = (pts[i] * size_dx) + position_dx;   // eslint-disable-line no-multi-spaces
    pts[i+1] = (pts[i+1] * size_dy) + position_dy;
  }

  const out = new this.constructor(pts);
  out._isClosed = this._isClosed;

  return out;
}

/**
 * Get bounding box, using clipper
 * @return {PIXI.Rectangle}
 */
function clipperBounds() {
  const path = this.clipperCoordinates;
  const bounds = ClipperLib.JS.BoundsOfPath(path); // Returns ClipperLib.FRect

  return new PIXI.Rectangle(
    bounds.left,
    bounds.top,
    bounds.right - bounds.left,
    bounds.bottom - bounds.top);
}


// ----------------  ADD METHODS TO THE PIXI.POLYGON PROTOTYPE --------------------------
export function registerPIXIPolygonMethods() {


  if ( !Object.hasOwn(PIXI.Polygon.prototype, "isClosed") ) {
    Object.defineProperty(PIXI.Polygon.prototype, "isClosed", {
      get: isClosed
    });
  }

  Object.defineProperty(PIXI.Polygon.prototype, "close", {
    value: close,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "getBounds", {
    value: clipperBounds,
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

  Object.defineProperty(PIXI.Polygon.prototype, "intersectPolygon", {
    value: intersectPolygon,
    writable: true,
    configurable: true
  });


  Object.defineProperty(PIXI.Polygon.prototype, "iterateClipperLibPoints", {
    value: iterateClipperLibPoints,
    writable: true,
    configurable: true
  });

  if ( !Object.hasOwn(PIXI.Polygon.prototype, "clipperCoordinates") ) {
    Object.defineProperty(PIXI.Polygon.prototype, "clipperCoordinates", {
      get: clipperCoordinates
    });
  }

  Object.defineProperty(PIXI.Polygon, "fromClipperPoints", {
    value: fromClipperPoints,
    writable: true,
    configurable: true
  });


  Object.defineProperty(PIXI.Polygon.prototype, "clipperClip", {
    value: clipperClip,
    writable: true,
    configurable: true
  });
}
