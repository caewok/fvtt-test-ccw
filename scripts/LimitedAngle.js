/*
Class to represent a limited angle in the ClockwiseSweep.

The angle is essentially two rays shot from a point directly at or behind the origin.
Typically, behind the origin is desired so that the constructed object will include the
origin for the sweep.

Methods provided to return temporary edges for the two angle walls, a polygon, or
a bounding box, as appropriate. Edges and bounding box extend at least to the canvas edge
but likely exceed the canvas edge.
*/

/* globals
Ray,
foundry,
canvas,
PIXI,
ClockwiseSweepPolygon
*/

'use strict';

/* testing


//

api = game.modules.get(`testccw`).api;
LimitedAngleSweepObject = api.LimitedAngleSweepObject
function drawPolygon(poly, color = 0xFF0000) {
  canvas.controls.debug.lineStyle(1, color).drawShape(poly);
}

// get data from token
token = canvas.tokens.controlled[0];
let [origin, angle, rotation, contain_origin] = [ token.center, token.data.sightAngle, token.data.rotation, true ]

limitedAngle = new LimitedAngleSweepObject(token.center, token.data.sightAngle, token.data.rotation);

drawPolygon(limitedAngle.getPolygon())

limitedAngle.getEdges()
limitedAngle.getBounds()
limitedAngle.containsPoint(token.center)


*/


import { pixelLineContainsPoint, pointsEqual } from "./utilities.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

export class LimitedAngleSweepObject {

 /**
  * @param { PIXI.Point } origin    Origin coordinate of the sweep
  * @param { number } angle         Desired angle of view, in degrees
  * @param { number } rotation      Center of the limited angle line, in degrees
  */
  constructor(origin, angle, rotation, { contain_origin = true } = {}) {
    // token rotation:
    // north is 180º (3.1415 or π radians)
    // west is 90º (1.5707 or π/2 radians)
    // south is 0º (0 radians)
    // east is 270º (-1.5707 or -π/2 radians)

    this.origin = origin;
    this.angle = angle;
    this.rotation = rotation;

    if(contain_origin) this._offsetOrigin();
    this._calculateLimitedAngles();
    this._setBoundaryPoints();
  }



 /**
  * Move the origin back one pixel to define the start point of the limited angle rays.
  * This ensures the actual origin is contained within the limited angle.
  */
  _offsetOrigin() {
    const r = Ray.fromAngle(this.origin.x,
                            this.origin.y,
                            Math.toRadians(this.rotation + 90), -1);
    this.origin = { x: Math.round(r.B.x), y: Math.round(r.B.y) };
  }

 /**
  * Calculate the rays that represent the limited angle
  */
  _calculateLimitedAngles() {
    this.aMin = Math.normalizeRadians(Math.toRadians(this.rotation + 90 - (this.angle / 2)));
    this.aMax = this.aMin + Math.toRadians(this.angle);

    this.rMin = Ray.fromAngle(this.origin.x, this.origin.y, this.aMin, canvas.dimensions.maxR);
    this.rMax = Ray.fromAngle(this.origin.x, this.origin.y, this.aMax, canvas.dimensions.maxR);
  }

 /**
  * Determine where the limited angle rays intersect the canvas edge.
  * (Needed primarily to easily construct a bounding box, but also helpful for
  *  providing edges or a polygon.)
  *
  * To make it easier to use the tracePolygon algorithm, the points are arranged clockwise
  * origin --> rMin.B --> canvas only points -> rMax.B --> origin
  *
  * Two options for how to get intersection:
  * 1. use canvas.dimensions.rect and test _intersectsTop, etc., against rMin/rMax
  * 2. compare angle of rad to rays from each of the four corners
  * Going with (1) because we also may need the points in order and need
  * to know if some corners are included because the angle > 180º.
  * Easier to do by "walk" around canvas edges
  */
  _setBoundaryPoints() {
    const origin = this.origin;
    const rMin = this.rMin;
    const rMax = this.rMax;
    const pts = [origin]; // all the points of the LimitedAngle polygon
    const canvas_pts = []; // just the canvas points, not including rMin or rMax endpoints
    const boundaries = [...canvas.walls.boundaries];
    // Find the boundary that intersects rMin and add intersection point.
    // store i, representing the boundary index.
    let i;
    const ln = boundaries.length;
    for(i = 0; i < ln; i += 1) {
      const boundary = boundaries[i];
      if(foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, boundary.A, boundary.B)) {
        // lineLineIntersection should be slightly faster and we already confirmed
        // the segments intersect
        const x = foundry.utils.lineLineIntersection(rMin.A, rMin.B,
                                                   boundary.A, boundary.B);
        pts.push(x);

        // reset rMin to the correct length to just intersect the canvas border
        this.rMin = new Ray(origin, x);
        this.rMin._angle = this.aMin;

        break;
      }
    }

    // "walk" around the canvas edges
    // starting with the rMin canvas intersection, check for rMax.
    // if not intersected, than add the corner point
    // if greater than 180º angle, don't start with rMin intersection b/c we need to
    // circle around
    if(this.angle > 180) {
      const boundary = boundaries[i];
      pts.push(boundary.B);
      canvas_pts.push(boundary.B);
      i = i + 1;
    }

    for(let j = 0; j < ln; j += 1) {
      const new_i = (i + j) % 4;
      const boundary = boundaries[new_i];
      if(foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, boundary.A, boundary.B)) {
        const x = foundry.utils.lineLineIntersection(rMax.A, rMax.B,
                                                     boundary.A, boundary.B);
        pts.push(x);


        // reset rMax to the correct length to just intersect the canvas border
        this.rMax = new Ray(origin, x);
        this.rMax._angle = this.aMax;

        break;

      } else {
        pts.push(boundary.B);
        canvas_pts.push(boundary.B);
      }
    }

    pts.push(origin);
    this.canvas_points = canvas_pts;
    this.points = pts;
  }

 /**
  * Calculate a bounding box for the limited angle.
  * @return { PIXI.Rectangle }
  */
  getBounds() {
    const x_coords = this.points.map(pt => pt.x);
    const y_coords = this.points.map(pt => pt.y);

    const minX = Math.min(...x_coords);
    const minY = Math.min(...y_coords);

    const maxX = Math.max(...x_coords);
    const maxY = Math.max(...y_coords);

    return new PIXI.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

 /**
  * Return two edges, one for each limited angle
  * @return { SimplePolygonEdge[2] }
  */
  getEdges() {
    return [
      new SimplePolygonEdge(this.origin, this.rMin.B),
      new SimplePolygonEdge(this.origin, this.rMax.B)
    ];
  }

 /**
  * Return a polygon representing the limited angle
  * @return { PIXI.Polygon }
  */
  getPolygon() {
    const out = PIXI.Polygon.fromPoints(this.points);

    // set certain known polygon properties
    out._isClosed = true;
    out._isConvex = this.angle < 180;
    out._isClockwise = true;
    return out;
  }

 /**
  * Test whether a point lies within this limited angle.
  * Note: does not consider whether it is outside the canvas boundary.
  * @param {Point} pt   Point to test
  * @return {boolean}   True if the point is on or within the limited angle
  */
  containsPoint(pt) {
    // keep points within a short distance of the ray, to avoid losing points on the ray
    return ClockwiseSweepPolygon.pointBetweenRays(pt, this.rMin, this.rMax, this.angle) ||
           pixelLineContainsPoint(this.rMin, pt, 2) ||
           pixelLineContainsPoint(this.rMax, pt, 2);
  }

  containsPolygon(poly) {
    const iter = poly.iteratePoints();
    for(const pt of iter) {
      if(!this.containsPoint(pt)) return false;
    }
    return true;
  }

  unionPolygon(poly) {
    return _combine(poly, this, { clockwise: false });
  }

  intersectPolygon(poly) {
    return _combine(poly, this, { clockwise: true });
  }
}

/**
 * Helper for union and intersect methods.
 * @param {PIXI.Polygon} poly
 * @param {LimitedAngle} limitedangle
 * Options:
 * @param {boolean} clockwise  True if the trace should go clockwise at each
 *                             intersection; false to go counterclockwise.
 * @return {PIXI.Polygon}
 * @private
 */
function _combine(poly, limitedAngle, { clockwise = true } = {}) {
  const pts = _tracePolygon(poly, limitedAngle, { clockwise });

  if(pts.length === 0) {
    // if no intersections, then either the polygons do not overlap (return null)
    // or one encompasses the other
    const union = !clockwise;
    if(polyContainsOther(limitedAngle.getPolygon())) {
      return union ? poly : limitedAngle.getPolygon();
    }

    if(limitedAngle.containsPolygon(poly)) {
      return union ? limitedAngle.getPolygon() : poly;
    }

    return null;

  }

  const new_poly = new PIXI.Polygon(pts);

  // algorithm always outputs a clockwise polygon
  new_poly._isClockwise = true;
  return new_poly;
}



function polyContainsOther(poly, other) {
  const iter = other.iteratePoints();
  for(const pt of iter) {
    if(!poly.contains(pt.x, pt.y)) return false;
  }
  return true;
}

/**
 * Basically the same algorithm as tracing a polygon with a circle.
 *
 * Trace around a polygon in the clockwise direction. At each intersection with
 * the LimitedAngle, select either the clockwise or counterclockwise direction
 * (based on the option). Return each vertex or intersection point encountered.
 *
 * Mark each time the trace jumps from the polygon to the limitedAngle, or back.
 * Note that this can only happen when one of the two angled lines intersect the
 * polygon.
 * When returning to the polygon, fill in the shape of the limited angle, including
 * any additions made by tracing the canvas edge.
 *
 * @param {PIXI.Circle}   circle
 * @param {PIXI.Polygon}  poly
 * @param {boolean} clockwise   True if the trace should go clockwise at each
 *                              intersection; false to go counterclockwise.
 * @return {number[]} Points array, in format [x0, y0, x1, y1, ...]
 */
function _tracePolygon(poly, limitedAngle, { clockwise = true }) {
  poly.close();
  if(!poly.isClockwise) poly.reverse();

  const rMax = limitedAngle.rMax;
  const rMin = limitedAngle.rMin;

  // store the starting data
  let ix_data = {
    pts: [],
    clockwise,
    density,
    is_tracing_polygon: false,
    // things added later
    started_at_rMin: false,
    prior_ix: undefined,
    canvas_points: limitedAngle.canvas_points,
    rMin: limitedAngle.rMin,
    rMax: limitedAngle.rMax,
  };

  let edges = [...poly.iterateEdges()];
  let ln = edges.length;
  let max_iterations = ln * 2;
  let first_intersecting_edge_idx = -1;
  let circled_back = false;
  for(let i = 0; i < max_iterations; i += 1) {
    if(circled_back) { break; } // back to first intersecting edge

    let edge_idx = i % ln;
    let next_edge_idx = (i + 1) % ln;
    let edge = edges[edge_idx];

//     console.log(`${i}: ${edge.A.x},${edge.A.y}|${edge.B.x},${edge.B.y} ${ix_data.is_tracing_segment ? "tracing" : "not tracing"} segment`);

    if(edge_idx === first_intersecting_edge_idx) { circled_back = true; }

    // test each limited angle ray in turn for intersection with this segment.
    const rMax_intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMax.A, rMax.B);
    const rMin_intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMin.A, rMin.B);

    // require LimitedAngle to be constructed such that, moving clockwise,
    // origin --> rMin --> canvas --> rMax --> origin
    // for union, walk clockwise and turn counterclockwise at each intersection
    // for intersect, walk clockwise and turn clockwise at each intersection
    if(rMax_intersects && rMin_intersects) {
      // start with the intersection closest to edge.A
      const ix_min = foundry.utils.lineLineIntersection(edge.A, edge.B, rMin.A, rMin.B);
      const ix_max = foundry.utils.lineLineIntersection(edge.A, edge.B, rMax.A, rMax.B);

      // unclear if this additional check for null is necessary
      if(!ix_min) {
        console.log(`ix_min should have an intersection but reported null.`);
        ix_max && processRMaxIntersection(ix_max, edges, next_edge_idx, edge, ix_data);
      } else if(!ix_max) {
        console.log(`ix_max should have an intersection but reported null.`);
        ix_min && processRMinIntersection(ix_min, edges, next_edge_idx, edge, ix_data);
      } else if(pointsEqual(ix_min, ix_max)) {
        // should only happen at origin
        // from origin, move to rMin
        processRMinIntersection(ix_min, edges, next_edge_idx, edge, ix_data);

      } else {
        const dx_min = ix_min.x - edge.A.x;
        const dy_min = ix_min.y - edge.A.y;
        const dx_max = ix_max.x - edge.A.x;
        const dy_max = ix_max.y - edge.A.y;

        const d2_min = dx_min * dx_min + dy_min * dy_min;
        const d2_max = dx_max * dx_max + dy_max * dy_max;

        if(d2_min < d2_max) {
          processRMinIntersection(ix_min, edges, next_edge_idx, edge, ix_data);
          processRMaxIntersection(ix_max, edges, next_edge_idx, edge, ix_data);
        } else {
          processRMaxIntersection(ix_max, edges, next_edge_idx, edge, ix_data);
          processRMinIntersection(ix_min, edges, next_edge_idx, edge, ix_data);
        }
      }

    } else if(rMin_intersects) {
      const ix = foundry.utils.lineLineIntersection(edge.A, edge.B, rMin.A, rMin.B);
      ix && processRMinIntersection(ix, edges, next_edge_idx, edge, ix_data);

    } else if(rMax_intersects) {
      const ix = foundry.utils.lineLineIntersection(edge.A, edge.B, rMax.A, rMax.B);
      ix && processRMaxIntersection(ix, edges, next_edge_idx, edge, ix_data);
    }

    if(ix_data.is_tracing_segment && !circled_back) {
      ix_data.pts.push(edge.B.x, edge.B.y);
    }
  }



  return ix_data.pts;
}



function processRMinIntersection(ix, edges, next_edge_idx, edge, ix_data) {
  let { clockwise, is_tracing_polygon, rMin, rMax, canvas_points } = ix_data;
  let was_tracing_polygon = is_tracing_polygon;

  if(!is_tracing_polygon && ix_data.at_rMin) { ix_data.circled_back = true; }
  const b = rMin.B;
  const c = pointsEqual(edge.B, ix) ? edges[next_edge_idx].B : edge.B;
  if(pointsEqual(rMin.B, ix)) {  console.warn(`intersection equals rMin.B ${rMin.B.x},${rMin.B.y}`); }

  // clockwise edges in 2 directions:
  // 1. next edge: edge.A --> ix --> edge.B --> next edge.B
  // 2. rMax: edge.A --> ix --> (along rMax) --> origin
  // if ix --> origin --> edge.B oriented clockwise && clockwise option is true, use edge.B
  // orientation is positive if edge.B is to the left (ccw) of ix --> origin
  const orientation = foundry.utils.orient2dFast(ix, b, c);
  if(orientation > 0 && !clockwise ||
       orientation < 0 && clockwise) {
    // switch to the other polygon
    is_tracing_polygon = !was_tracing_polygon;
  }

  if(!(was_tracing_polygon ^ is_tracing_polygon)) return;

  if(was_tracing_polygon && !is_tracing_polygon) {
    // we moved from polygon --> limitedAngle
    // store the intersection and whether this is rMin or rMax
    ix_data.prior_ix = ix;
    ix_data.at_rMin = true;
    ix_data.circled_back = false;
    return;
  }

  // (!was_tracing_polygon && is_tracing_polygon)
  // we moved from limitedAngle --> polygon
  // get the points from the previous intersection to the current
  // options:
  // 1. both previous and current ix are on the same ray: no points to add in between
  // 2. moved from rMax --> origin --> rMin. Add origin point
  // 3. moved from rMin --> canvas --> rMax. Add canvas edge point(s)\
  // 4. both previous and current ix are on the same ray but we circled back around:
  //    need to add all points between. e.g.,
  //    (a) rMax --> origin --> rMin --> canvas --> rMax
  //    (b) rMin --> canvas --> rMax --> origin --> rMin
  ix_data.pts.push(ix_data.prior_ix.x, ix_data.prior_ix.y);

  if(ix_data.started_at_rMin) {
    if(ix_data.circled_back) {
      // (4)(b) rMin --> canvas --> rMax --> origin --> rMin
      if(!pointsEqual(ix, rMin.B)) { ix_data.pts.push(rMin.B.x, rMin.B.y); }
      ix_data.pts.push(...canvas_points);
      ix_data.pts.push(rMax.B.x, rMax.B.y);
      ix_data.pts.push(rMax.A.x, rMax.A.y);
    }
    // otherwise: (1) previous and current ix on the same ray; do nothing

  } else { // started at rMax
    // (2) rMax --> origin --> rMin
    if(!pointsEqual(ix, rMax.A)) { ix_data.pts.push(rMax.A.x, rMax.A.y); }
  }

  ix_data.pts.push(ix.x, ix.y);
}

function processRMaxIntersection(ix, edges, next_edge_idx, edge, ix_data) {
  let { clockwise, is_tracing_polygon, rMin, rMax, canvas_points } = ix_data;
  let was_tracing_polygon = is_tracing_polygon;

  if(!is_tracing_polygon && !ix_data.at_rMin) { ix_data.circled_back = true; }
  const b = rMax.A;
  const c = pointsEqual(edge.B, ix) ? edges[next_edge_idx].B : edge.B;
  if(pointsEqual(rMax.A, ix)) {  console.warn(`intersection at origin but rMin intersection not detected.`); }

  // clockwise edges in 2 directions:
  // 1. next edge: edge.A --> ix --> edge.B --> next edge.B
  // 2. rMax: edge.A --> ix --> (along rMax) --> origin
  // if ix --> origin --> edge.B oriented clockwise && clockwise option is true, use edge.B
  // orientation is positive if edge.B is to the left (ccw) of ix --> origin

  const orientation = foundry.utils.orient2dFast(ix, b, c);
  if(orientation > 0 && !clockwise ||
       orientation < 0 && clockwise) {
    // switch to the other polygon
    is_tracing_polygon = !was_tracing_polygon;
  }

  if(!(was_tracing_polygon ^ is_tracing_polygon)) return;

  if(was_tracing_polygon && !is_tracing_polygon) {
    // we moved from polygon --> limitedAngle
    // store the intersection and whether this is rMin or rMax
    ix_data.prior_ix = ix;
    ix_data.at_rMin = false;
    ix_data.circled_back = false;
    return;
  }

  // (!was_tracing_polygon && is_tracing_polygon)
  // we moved from limitedAngle --> polygon
  // get the points from the previous intersection to the current
  // options:
  // 1. both previous and current ix are on the same ray: no points to add in between
  // 2. moved from rMax --> origin --> rMin. Add origin point
  // 3. moved from rMin --> canvas --> rMax. Add canvas edge point(s)\
  // 4. both previous and current ix are on the same ray but we circled back around:
  //    need to add all points between. e.g.,
  //    (a) rMax --> origin --> rMin --> canvas --> rMax
  //    (b) rMin --> canvas --> rMax --> origin --> rMin
  ix_data.pts.push(ix_data.prior_ix.x, ix_data.prior_ix.y);

  if(ix_data.started_at_rMax) {
    if(ix_data.circled_back) {
      // (4)(a) rMax --> origin --> rMin --> canvas --> rMax
      if(!pointsEqual(ix, rMax.B)) { ix_data.pts.push(rMax.B.x, rMax.B.y); }
      ix_data.pts.push(rMin.B.x, rMin.B.y);
      ix_data.pts.push(...canvas_points);
      ix_data.pts.push(rMax.B.x, rMax.B.y);
    }
    // otherwise (1) previous and current ix on the same ray

  } else { // started at rMin
    // (3) moved from rMin --> canvas --> rMax
    if(!pointsEqual(ix, rMin.B)) { ix_data.pts.push(rMin.B.x, rMin.B.y); }
    ix_data.pts.push(...canvas_points);
    ix_data.pts.push(rMax.B.x, rMax.B.y);
  }

  ix_data.prior_ix = undefined;
  ix_data.circled_back = false;

  ix_data.pts.push(ix.x, ix.y);
}
