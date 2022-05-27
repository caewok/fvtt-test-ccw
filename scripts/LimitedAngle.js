/*
Class to represent a limited angle in the ClockwiseSweep, as an extension of PIXI.Polygon.

The angle is essentially two rays shot from a point directly at or behind the origin.
Typically, behind the origin is desired so that the constructed object will include the
origin for the sweep.

Methods include:
- Constructor build method.
- Getting the calculated minimum (rMin) and maximum (rMax) rays.
- Calculating points along the canvas for the polygon.
- Whether a point is contained on or within the limited angle.
- union and intersect the limited angle with a polygon.

Union and intersect use the same algorithm as circle/polygon union and intersect.
The polygon is traced in clockwise direction, noting the intersection points with
the limited angle. Where tracing the limited angle would be the more clockwise (intersect)
or counterclockwise (union) direction, the points of the limited angle between the
two intersections are used. Otherwise, the polygon edge points are used. This is fast,
but requires that the polygon and limited angle both encompass the origin/weighted
center point.

*/

/* globals
Ray,
foundry,
canvas,
PIXI,
ClockwiseSweepPolygon,
*/

"use strict";

import { pixelLineContainsPoint, pointFromAngle } from "./utilities.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { tracePolygon } from "./trace_polygon.js";

export class LimitedAngleSweepPolygon extends PIXI.Polygon {

  // The new constructor is kept the same as PIXI.Polygon and
  // Thus should not be called directly. Use build instead.

  /**
   * @param { PIXI.Point } origin    Origin coordinate of the sweep
   * @param { number } angle         Desired angle of view, in degrees
   * @param { number } rotation      Center of the limited angle line, in degrees
   */
  static build(origin, angle, rotation, { contain_origin = true } = {}) {
    if (contain_origin) { origin = this.offsetOrigin(origin, rotation); }
    const { rMin, rMax } = this.constructLimitedAngleRays(origin, rotation, angle);
    const points = this.getBoundaryPoints(origin, angle, rMin, rMax);

    const poly = new this(points);
    poly.angle = angle;
    poly.rotation = rotation;
    poly.rMin = rMin;
    poly.rMax = rMax;

    // Set certain known polygon properties
    poly._isClosed = true;
    poly._isConvex = angle < 180;
    poly._isClockwise = true;

    return poly;
  }

  /**
   * @type {Point}
   */
  get origin() { return { x: this.points[0], y: this.points[1] }; }

  /**
   * Points between rMin.B and rMax.B along the canvas edge. May be length 0.
   * @type {Point[]}
   */
  get canvas_points() {
    // Points[0,1]: origin x,y
    // Points[2,3]: rMin.B x,y
    // Points[ln-4, ln-3]: rMax.B x,y
    // Points[ln-2, ln-1]: origin x.y
    const pts_ln = this.points.length;
    if (pts_ln < 8) return [];

    const pts = [];
    const ln = pts_ln - 4;
    for ( let i = 4; i < ln; i += 2 ) {
      pts.push({ x: this.points[i], y: this.points[i + 1] });
    }

    return pts;
  }

  /**
   * Point where rMin intersects the canvas edge.
   * @type {Point}
   */
  get rMin_ix() { return { x: this.points[2], y: this.points[3] }; }

  /**
   * Point where rMax intersects the canvas edge.
   * @type {Point}
   */
  get rMax_ix() {
    const ln = this.points.length;
    return { x: this.points[ln - 4], y: this.points[ln - 3] };
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
    /* eslint-disable indent */
    const r = pointFromAngle(origin, Math.toRadians(rotation + 90), -1);
    return { x: Math.round(r.x), y: Math.round(r.y) };
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
   *
   * @param {Point} origin
   * @param {Ray}   rMin    Ray from origin on the left side of the "viewer."
   * @param {Ray}   rMax    Ray from origin on the right side of the "viewer."
   * @return {Points[]} Array of points representing the limited angle polygon.
   */
  static getBoundaryPoints(origin, angle, rMin, rMax) {
    const points = [origin.x, origin.y]; // All the points of the LimitedAngle polygon
    const boundaries = [...canvas.walls.boundaries];
    // Find the boundary that intersects rMin and add intersection point.
    // Store i, representing the boundary index.
    let i;
    const ln = boundaries.length;
    for (i = 0; i < ln; i += 1) {
      const boundary = boundaries[i];
      if (foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, boundary.A, boundary.B)) {
        // LineLineIntersection should be slightly faster and we already confirmed
        // the segments intersect.
        const ix = foundry.utils.lineLineIntersection(rMin.A, rMin.B,
                                                   boundary.A, boundary.B); // eslint-disable indent
        points.push(ix.x, ix.y);
        break;
      }
    }

    // If angle is greater than 180º, we know we need at least one boundary.
    // So add the boundary with which rMin collides first.
    // This avoids the issue whereby an angle at, say 359º, would have rMin and rMax
    // intersect the same canvas border but first we need to add all border corners.
    if (angle > 180) {
      const boundary = boundaries[i];
      points.push(boundary.B.x, boundary.B.y);
      i = i + 1;
    }

    // "Walk" around the canvas edges.
    // Starting with the rMin canvas intersection, check for rMax.
    // If not intersected, than add the corner point.
    for (let j = 0; j < ln; j += 1) {
      const new_i = (i + j) % 4;
      const boundary = boundaries[new_i];
      if (foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, boundary.A, boundary.B)) {
        const ix = foundry.utils.lineLineIntersection(rMax.A, rMax.B, boundary.A, boundary.B);
        points.push(ix.x, ix.y);
        break;

      } else {
        points.push(boundary.B.x, boundary.B.y);
      }
    }

    points.push(origin.x, origin.y);

    return points;
  }

  /**
   * Test whether a point lies within this limited angle.
   * Note: does not consider whether it is outside the canvas boundary.
   * @param {Point} pt   Point to test
   * @return {boolean}   True if the point is on or within the limited angle
   */
  containsPoint(pt) {
    // Keep points within a short distance of the ray, to avoid losing points on the ray
    return ClockwiseSweepPolygon.pointBetweenRays(pt, this.rMin, this.rMax, this.angle)
           || pixelLineContainsPoint(this.rMin, pt, 2)
           || pixelLineContainsPoint(this.rMax, pt, 2);
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
   * Get the polygon representing the union between this limited angle and a polygon.
   * @param {PIXI.Polygon}  poly
   * @return {PIXI.Polygon}
   */
  unionPolygon(poly) { return tracePolygon(poly, this, { union: true }); }

  /**
   * Get the polygon representing the intersect between this limited angle and a polygon.
   * @param {PIXI.Polygon}  poly
   * @return {PIXI.Polygon}
   */
  intersectPolygon(poly) { return tracePolygon(poly, this, { union: false }); }

  /**
   * Determine whether an edge can be excluded (for purposes of ClockwiseSweep).
   * Edge is considered outside the limited angle if:
   * Angle < 180º (outside the "V" shape):
   *   - endpoints are both to the left (ccw) of rMin or
   *   - endpoints are both to the right (cw) of rMax or
   *   - endpoints are both "behind" the origin
   * Angle > 180º (inside the "V" shape):
   *   - endpoints are both to the left (ccw) of rMin and
   *   - endpoints are both to the right (cw) of rMax and
   *   - endpoints are both "behind" the origin
   * Angle = 180º:
   *   - endpoints are both to the left (ccw) of rMin and
   *   - endpoints are both to the right (cw) of rMax
   *
   * Note: these rules prevent treating as "outside" an edge that crosses
   *       the "V" either in part or in whole.
   *
   * @param {Segment} edge
   * @return {Boolean}
   */
  edgeIsOutside(edge) {
    /* eslint-disable no-multi-spaces */
    const origin = this.origin;
    const minB   = this.rMin.B;
    const maxB   = this.rMax.B;
    const edgeA  = edge.A;
    const edgeB  = edge.B;
    const angle  = this.angle;
    /* eslint-enable no-multi-spaces */

    // Remember, orientation > 0 if CCW (left)
    // The following ignores orientation = 0. In theory, if an endpoint is on
    // rMin or rMax, the edge can be ignored if it otherwise qualifies.
    // But the below code only does that in one direction (angle > 180º).
    // TO-DO: Are endpoints very near the rMin or rMax lines problematic because
    //        this code uses a fast floating point approximation for orient2d?

    const A_left_of_rMin = foundry.utils.orient2dFast(origin, minB, edgeA) > 0;
    const B_left_of_rMin = foundry.utils.orient2dFast(origin, minB, edgeB) > 0;
    const edge_left_of_rMin = A_left_of_rMin && B_left_of_rMin;
    if (angle < 180 && edge_left_of_rMin) return true;

    const A_right_of_rMax = foundry.utils.orient2dFast(origin, maxB, edgeA) < 0;
    const B_right_of_rMax = foundry.utils.orient2dFast(origin, maxB, edgeB) < 0;
    const edge_right_of_rMax = A_right_of_rMax && B_right_of_rMax;
    if (angle < 180 && edge_right_of_rMax) return true;

    if (angle === 180) { return edge_left_of_rMin && edge_right_of_rMax; }

    // If endpoints are "behind" the origin and angle < 180º, we know it is outside
    // This is tricky: what is "behind" the origin varies based on rotation
    // Luckily, we have the rotation.
    // rOrthogonal goes from origin to the right (similar to rMax)
    // test that origin --> orth.B --> pt is clockwise
    const rOrthogonal = this.orthogonalOriginRay();
    const A_behind_origin = foundry.utils.orient2dFast(rOrthogonal.A, rOrthogonal.B, edgeA) < 0;
    const B_behind_origin = foundry.utils.orient2dFast(rOrthogonal.A, rOrthogonal.B, edgeB) < 0;
    const edge_behind_origin = A_behind_origin && B_behind_origin;

    if (angle > 180) {
      return edge_left_of_rMin && edge_right_of_rMax && edge_behind_origin;
    }

    // Angle < 180
    // If one endpoint is behind the origin, then the other can be either left or right
    /* eslint-disable no-multi-spaces */
    const edge_sw_of_origin =    (A_behind_origin && B_left_of_rMin)
                              || (B_behind_origin && A_left_of_rMin);

    const edge_se_of_origin =    (A_behind_origin && B_right_of_rMax)
                              || (B_behind_origin && A_right_of_rMax);

    return    edge_sw_of_origin
           || edge_se_of_origin
           || edge_left_of_rMin
           || edge_right_of_rMax
           || edge_behind_origin;
    /* eslint-enable no-multi-spaces */
  }

  /**
   * Construct a ray orthogonal to the direction the token is facing, based
   * on origin and rotation.
   * See offsetOrigin for a similar calculation reversing the facing direction.
   * Used by edgeIsOutside.
   * @param {Number} d    Length or distance of the desired ray.
   * @return  A ray that extends from origin to the right (direction of rMax)
   *          from the perspective of the token.
   */
  orthogonalOriginRay(d = 100) {
    return Ray.fromAngle(this.origin.x, this.origin.y, Math.toRadians(this.rotation + 180), d);
  }
}
