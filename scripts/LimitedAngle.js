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
limitedAngle = new LimitedAngleSweepObject(token.center, token.data.sightAngle, token.data.rotation);

drawPolygon(limitedAngle.getPolygon())

limitedAngle.getEdges()
limitedAngle.getBounds()
limitedAngle.containsPoint(token.center)


*/


import { pixelLineContainsPoint } from "./utilities.js";
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


 // --------------- Getters --------------- //

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
    const pts = [origin];
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
      }
    }

    pts.push(origin);

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
    return PIXI.Polygon.fromPoints(this.points);
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

}