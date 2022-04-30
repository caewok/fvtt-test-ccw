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
limitedAngle = LimitedAngleSweepPolygon.build(token.center, token.data.sightAngle, token.data.rotation);

clearDrawings()
drawPolygon(limitedAngle, COLORS.red)
drawEdge(limitedAngle.rMin, COLORS.blue)
drawEdge(limitedAngle.rMax, COLORS.green)

limitedAngle.getEdges()
limitedAngle.getBounds()
limitedAngle.containsPoint(token.center)


*/


import { pixelLineContainsPoint, pointsEqual } from "./utilities.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

export class LimitedAngleSweepPolygon extends PIXI.Polygon {

  // the new constructor is kept the same as PIXI.Polygon and
  // thus should not be called directly. Use build instead.

 /**
  * @param { PIXI.Point } origin    Origin coordinate of the sweep
  * @param { number } angle         Desired angle of view, in degrees
  * @param { number } rotation      Center of the limited angle line, in degrees
  */
  static build(origin, angle, rotation, { contain_origin = true } = {}) {
    if(contain_origin) { origin = this.offsetOrigin(origin, rotation); }
    const { rMin, rMax } = this.constructLimitedAngleRays(origin, rotation, angle);
    const { new_rMin, new_rMax, canvas_points, points } = this.getBoundaryPoints(origin, rMin, rMax, angle);

    const poly = new this(points);
    poly.origin = origin;
    poly.angle = angle;
    poly.rotation = rotation;
    poly.rMin = new_rMin;
    poly.rMax = new_rMax;
    poly.canvas_points = canvas_points;

    // set certain known polygon properties
    poly._isClosed = true;
    poly._isConvex = angle < 180;
    poly._isClockwise = true;

    return poly;
  }

 /**
  * Create the two limited rays from the origin extending outwards with angle in-between.
  * @param {Point} origin
  * @param {Number} rotation    In degrees
  * @param {Number} angle       In degrees
  * @return {Object} Returns two rays, { rMin, rMax }
  */
  static constructLimitedAngleRays(origin, rotation, angle) {
    const aMin = Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2)));
    const aMax = aMin + Math.toRadians(angle);

    const rMin = Ray.fromAngle(origin.x, origin.y, aMin, canvas.dimensions.maxR);
    const rMax = Ray.fromAngle(origin.x, origin.y, aMax, canvas.dimensions.maxR);

    return { rMin, rMax };
  }

 /**
  * Move the origin back one pixel to define the start point of the limited angle rays.
  * This ensures the actual origin is contained within the limited angle.
  * @param {Point} origin       Origin coordinate of the sweep.
  * @param {Number} rotation    Center of the limited angle line, in degrees.
  */
  static offsetOrigin(origin, rotation) {
    const r = Ray.fromAngle(origin.x,
                            origin.y,
                            Math.toRadians(rotation + 90), -1);
    return { x: Math.round(r.B.x), y: Math.round(r.B.y) };
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
  static getBoundaryPoints(origin, rMin, rMax, angle) {
    const points = [origin.x, origin.y]; // all the points of the LimitedAngle polygon
    const canvas_points = []; // just the canvas points, not including rMin or rMax endpoints
    const boundaries = [...canvas.walls.boundaries];
    let new_rMin, new_rMax;
    // Find the boundary that intersects rMin and add intersection point.
    // store i, representing the boundary index.
    let i;
    const ln = boundaries.length;
    for(i = 0; i < ln; i += 1) {
      const boundary = boundaries[i];
      if(foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, boundary.A, boundary.B)) {
        // lineLineIntersection should be slightly faster and we already confirmed
        // the segments intersect
        const ix = foundry.utils.lineLineIntersection(rMin.A, rMin.B,
                                                   boundary.A, boundary.B);
        points.push(ix.x, ix.y);

        // reset rMin to the correct length to just intersect the canvas border
        new_rMin = new Ray(origin, ix);
        new_rMin._angle = rMin.angle//this.aMin;

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
      points.push(boundary.B.x, boundary.B.y);
      canvas_points.push(boundary.B.x, boundary.B.y);
      i = i + 1;
    }

    for(let j = 0; j < ln; j += 1) {
      const new_i = (i + j) % 4;
      const boundary = boundaries[new_i];
      if(foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, boundary.A, boundary.B)) {
        const ix = foundry.utils.lineLineIntersection(rMax.A, rMax.B,
                                                     boundary.A, boundary.B);
        points.push(ix.x, ix.y);


        // reset rMax to the correct length to just intersect the canvas border
        new_rMax = new Ray(origin, ix);
        new_rMax._angle = rMax.angle;

        break;

      } else {
        points.push(boundary.B.x, boundary.B.y);
        canvas_points.push(boundary.B.x, boundary.B.y);
      }
    }

    points.push(origin.x, origin.y);

    return { new_rMin, new_rMax, canvas_points, points}
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

/* testing
walls = [...canvas.walls.placeables]

poly = new PIXI.Polygon(
  977, -100,
  1200, 900,
  1900, 1900,
  -100, 1900,
  -100, -100,
  977, -100
)

*/




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
function _tracePolygon(poly, limitedAngle, { clockwise = true } = {}) {
  poly.close();
  if(!poly.isClockwise) poly.reverse();

  let rMax = limitedAngle.rMax;
  let rMin = limitedAngle.rMin;

  // store the starting data
  let ix_data = {
    pts: [],
    clockwise,
    is_tracing_polygon: undefined,
    // things added later
    started_at_rMin: false,
    canvas_points: limitedAngle.canvas_points,
    circled_back: false,
    started_at_rMin: undefined,
    prior_ix: undefined,
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

     // i += 1
    let edge_idx = i % ln;
    let next_edge_idx = (i + 1) % ln;
    let edge = edges[edge_idx];
    drawEdge(edge, COLORS.red)

//     console.log(`${i}: ${edge.A.x},${edge.A.y}|${edge.B.x},${edge.B.y} ${ix_data.is_tracing_segment ? "tracing" : "not tracing"} segment`);

    // test each limited angle ray in turn for intersection with this segment.
    let rMax_intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMax.A, rMax.B);
    let rMin_intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMin.A, rMin.B);

    if(rMin_intersects || rMax_intersects) {
      // Flag if we are back at the first intersecting edge.
      (edge_idx === first_intersecting_edge_idx) && (circled_back = true);

      if(!~first_intersecting_edge_idx) {
        first_intersecting_edge_idx = edge_idx;
        ix_data.is_tracing_polygon = true;
      }
    }

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

    if(ix_data.is_tracing_polygon && !circled_back) {
      ix_data.pts.push(edge.B.x, edge.B.y);
    }
  }



  return ix_data.pts;
}


/* Intersection options:

1. The polygon is along the canvas border, and it intersects rMax.B or rMin.B.
   a. intersects rMin.B --> follow the polygon
   b. intersects rMax.B --> choose the polygon or rMax based on orientation
2. The polygon intersects somewhere along rMax or rMin.
   -- follow rMin/rMax or polygon based on orientation
3. The polygon intersects at origin (rMax.A/rMin.A)
   -- follow rMin or polygon based on orientation

*/


function processRMinIntersection(ix, edges, next_edge_idx, edge, ix_data) {
  let { clockwise, rMin, rMax, canvas_points } = ix_data;
  let was_tracing_polygon = ix_data.is_tracing_polygon;

  if(!ix_data.is_tracing_polygon && !ix_data.at_rMin) { ix_data.circled_back = true; }

  if(pointsEqual(ix, rMin.B)) {
    ix_data.is_tracing_polygon = true;
  } else {
    let a = ix;
    let b = pointsEqual(ix, edge.B) ? edges[next_edge_idx].B : edge.B;
    let c = rMin.B;

    orientation = foundry.utils.orient2dFast(a, b, c);

    if(orientation > 0 && !clockwise ||
      orientation < 0 && clockwise) {
      // switch to the other polygon
      ix_data.is_tracing_polygon = !was_tracing_polygon;
    }

    if(!orientation) { return; } // stick with the current path
  }

  if(!(was_tracing_polygon ^ ix_data.is_tracing_polygon)) return;

  if(was_tracing_polygon && !ix_data.is_tracing_polygon) {
    // we moved from polygon --> limitedAngle
    // store the intersection and whether this is rMin or rMax
    ix_data.prior_ix = ix;
    ix_data.started_at_rMin = true;
    ix_data.circled_back = false;
    return;
  }

  // (!was_tracing_polygon && is_tracing_polygon)
  // we moved from limitedAngle --> polygon
  // get the points from the previous intersection to the current
  // options:
  // 1. both previous and current ix are on the same ray: no points to add in between
  // 2. moved from rMax --> origin/rMin.A --> rMin. Add origin point
  // 3. moved from rMin --> rMin.B --> canvas --> rMax.B. Add canvas edge point(s)\
  // 4. both previous and current ix are on the same ray but we circled back around:
  //    need to add all points between. e.g.,
  //    (a) rMax --> origin/rMin.A --> rMin.B --> canvas --> rMax.B
  //    (b) rMin --> rMin.B --> canvas --> rMax.B --> origin/rMin.A
  ix_data.pts.push(ix_data.prior_ix.x, ix_data.prior_ix.y);

  if(ix_data.started_at_rMin) {
    if(ix_data.circled_back) {
      // (4)(b) rMin --> rMin.B --> canvas --> rMax.B --> origin/rMin.A
      if(!pointsEqual(ix, rMin.B)) { ix_data.pts.push(rMin.B.x, rMin.B.y); }
      ix_data.pts.push(...canvas_points);
      ix_data.pts.push(rMax.B.x, rMax.B.y);
      ix_data.pts.push(rMin.A.x, rMin.A.y);
    }
    // otherwise: (1) previous and current ix on the same ray; do nothing

  } else { // started at rMax
    // (2) rMax --> origin/rMin.A --> rMin
    if(!pointsEqual(ix, rMax.A)) { ix_data.pts.push(rMax.A.x, rMax.A.y); }
  }

  ix_data.prior_ix = undefined;
  ix_data.circled_back = false;

  ix_data.pts.push(ix.x, ix.y);
}

function processRMaxIntersection(ix, edges, next_edge_idx, edge, ix_data) {
  let { clockwise, rMin, rMax, canvas_points } = ix_data;
  let was_tracing_polygon = ix_data.is_tracing_polygon;

  if(!ix_data.is_tracing_polygon && !ix_data.at_rMin) { ix_data.circled_back = true; }

  let a = ix;
  let b = pointsEqual(edge.B, ix) ? edges[next_edge_idx].B : edge.B;
  let c = rMax.A;
  let orientation = foundry.utils.orient2dFast(ix, b, c);

  if(!orientation) { return; } // stick with the current path

  // clockwise edges in 2 directions:
  // 1. next edge: edge.A --> ix --> edge.B --> next edge.B
  // 2. rMax: edge.A --> ix --> (along rMax) --> origin/rMax.A
  // if ix --> origin --> edge.B oriented clockwise && clockwise option is true, use edge.B
  // orientation is positive if edge.B is to the left (ccw) of ix --> origin
  if(orientation > 0 && !clockwise ||
       orientation < 0 && clockwise) {
    // switch to the other polygon
    ix_data.is_tracing_polygon = !was_tracing_polygon;
  }

  if(!(was_tracing_polygon ^ ix_data.is_tracing_polygon)) return;

  if(was_tracing_polygon && !ix_data.is_tracing_polygon) {
    // we moved from polygon --> limitedAngle
    // store the intersection and whether this is rMin or rMax
    ix_data.prior_ix = ix;
    ix_data.started_at_rMin = false;
    ix_data.circled_back = false;
    return;
  }

  // (!was_tracing_polygon && is_tracing_polygon)
  // we moved from limitedAngle --> polygon
  // get the points from the previous intersection to the current
  // options:
  // 1. both previous and current ix are on the same ray: no points to add in between
  // 2. moved from rMax --> rMax.A/origin --> rMin.B Add origin point
  // 3. moved from rMin --> rMin.B --> canvas --> rMax.B Add canvas edge point(s)\
  // 4. both previous and current ix are on the same ray but we circled back around:
  //    need to add all points between. e.g.,
  //    (a) rMax --> origin/rMin.A --> rMin.B --> canvas --> rMax.B
  //    (b) rMin --> rMin.B --> canvas --> rMax.B --> origin/rMin.A
  ix_data.pts.push(ix_data.prior_ix.x, ix_data.prior_ix.y);

  if(!ix_data.started_at_rMin) {
    if(ix_data.circled_back) {
      // (4)(a) rMax --> origin/rMin.A --> rMin.B --> canvas --> rMax.B
      if(!pointsEqual(ix, rMin.A)) { ix_data.pts.push(rMin.A.x, rMin.A.y); }
      ix_data.pts.push(rMin.B.x, rMin.B.y);
      ix_data.pts.push(...canvas_points);
      ix_data.pts.push(rMax.B.x, rMax.B.y);
    }
    // otherwise (1) previous and current ix on the same ray

  } else { // started at rMin
    // (3) rMin.B --> canvas --> rMax.B
    if(!pointsEqual(ix, rMin.B)) { ix_data.pts.push(rMin.B.x, rMin.B.y); }
    ix_data.pts.push(...canvas_points);
    ix_data.pts.push(rMax.B.x, rMax.B.y);
  }

  ix_data.prior_ix = undefined;
  ix_data.circled_back = false;

  ix_data.pts.push(ix.x, ix.y);
}
