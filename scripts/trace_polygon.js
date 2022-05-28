/* globals
PIXI,
foundry
*/
"use strict";

import { findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";
import { LimitedAngleSweepPolygon } from "./LimitedAngle.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { distanceSquared, pointsEqual } from "./utilities.js";

/*
Trace a polygon in the clockwise direction. At each intersection with the other shape,
select the clockwise direction (intersect) or counterclockwise direction (union). Repeat
at each intersection. The traced object will be the intersection or union if the
shape shares the center point or origin with the polygon.

For each shape type, extend the TraceObject class, implementing these methods:
- findIntersections: Identify all intersections between the polygon and the shape,
    and whether the polygon and shape outlines cross at that point.
- clockwiseForPolygonAtIntersection: For a given intersection, will turning clockwise
    continue to trace the polygon assuming you are tracing the polygon clockwise.
- shapePointsBetween: Between two intersections, return the points necessary to
    approximate the shape with a polygon

buildTraceObject is a helper function to create the appropriate TraceObject for a given
shape.

*/

export function tracePolygon(poly, shape, { union = true, density = 60 } = {}) {
  poly.close();

  // CCW: orientation is positive
  // CW: orientation is negative
  // Want to turn CCW to form union
  const turn_direction = union ? 1 : -1;
  const traceObj = buildTraceObject(poly, shape, { density });
  const edges = TraceObject.linkedEdges(poly);

  // Get all the intersections for edges along the polygon, in order
  const ixObjs = [];
  for ( const edge of edges ) {
    const arr = traceObj.findIntersections(edge);
    if ( arr.length ) { ixObjs.push(...arr); }
  }
  if ( !ixObjs.length ) { return null; }

  // For starting intersection, determine if moving clockwise will stay on the poly or
  // will move to other shape. Go in desired direction as indicated by union parameter.
  // For union, turn counterclockwise; for intersection turn clockwise.
  let prev_ixObj = ixObjs[0];
  const last_ixObj = prev_ixObj; // Repeat the last object to close the points at the end
  const orient = traceObj.polygonOrientationAtIntersection(prev_ixObj);
  let is_tracing_poly = (orient * turn_direction) >= 0;

  const pts = [prev_ixObj];
  const ln = ixObjs.length;
  for ( let i = 1; i < ln; i += 1) {
    let ixObj = ixObjs[i];

    // If consecutive points are nearly the same, skip
    if ( pointsEqual(ixObj, prev_ixObj) ) { continue; } // Could skip for better performance (just repeated points in the polygon)

    const orient = traceObj.polygonOrientationAtIntersection(ixObj);
    const was_tracing_poly = is_tracing_poly;
    is_tracing_poly = (orient * turn_direction) >= 0;

    if ( was_tracing_poly ^ is_tracing_poly ) {
      const padding = was_tracing_poly
        ? traceObj.polygonPointsBetween(prev_ixObj, ixObj)
        : traceObj.shapePointsBetween(prev_ixObj, ixObj);
      padding.length && pts.push(...padding); // eslint-disable-line no-unused-expressions
      pts.push(ixObj);

      prev_ixObj = ixObj;
    }
  }

  // If never switched shapes, return the shape
  if ( last_ixObj === prev_ixObj ) { return is_tracing_poly ? poly : shape; }

  // If the last point repeats, we are done
  if ( pointsEqual(prev_ixObj, last_ixObj) ) { return new PIXI.Polygon(pts); }

  // Fill in padding to the first intersection
  const padding = is_tracing_poly
    ? traceObj.polygonPointsBetween(prev_ixObj, last_ixObj)
    : traceObj.shapePointsBetween(prev_ixObj, last_ixObj);
  padding.length && pts.push(...padding); // eslint-disable-line no-unused-expressions
  pts.push(last_ixObj);

  return new PIXI.Polygon(pts);
}

/**
 * Helper to build a TraceObject of the correct subtype, given a shape.
 * @param {PIXI.Polygon}  poly
 * @param {Object}        shape
 * @return {TraceObject}
 */
function buildTraceObject(poly, shape) {
  switch ( shape.constructor ) {
    case PIXI.Polygon: return new PolygonTraceObject(poly, shape);
    case PIXI.Circle: return new CircleTraceObject(poly, shape);
    case PIXI.Rectangle: return new RectangleTraceObject(poly, shape);
    case LimitedAngleSweepPolygon: return new LimitedAngleTraceObject(poly, shape);
  }
  return new TraceObject(poly, shape);
}

/**
 * Class that identifies methods to assist with union or intersect of a polygon with
 * a shape using a tracing method.
 */
class TraceObject {
  /**
   * @param {PIXI.Polygon}  poly    Polygon to be traced
   * @param {Object}  shape         Arbitrary shape. (Dealt with by subclass)
   */
  constructor(poly, shape) {
    this.poly = poly;
    this.shape = shape;
  }

  /**
   * Test if two edges are equal. linkedEdges method returns SimplePolygonEdge,
   * so edges can be tested using nw and sw keys.
   * @param {SimplePolygonEdge} edge1
   * @param {SimplePolygonEdge} edge2
   * @return {Boolean}  True if equal endpoints.
   */
  static edgesEqual(edge1, edge2) {
    return edge1.nw.key === edge2.nw.key && edge1.se.key === edge2.se.key;
  }

  /**
   * Return all the points between two intersections of this.poly.
   * Takes advantage of fact that findIntersections should return linkedEdges.
   * Thus, can walk from ixObj1.edge using edge.next.
   * @param {Object}  ixObj1  Intersection object
   * @param {Object}  ixObj2  Intersection object
   * @return {Points[]}
   */
  polygonPointsBetween(ixObj1, ixObj2) {
    const pts = [];
    let curr_edge = ixObj1.edge;
    const target_edge = ixObj2.edge;
    if ( TraceObject.edgesEqual(curr_edge, target_edge) ) return [];
    pointsEqual(curr_edge.B, ixObj1) && (curr_edge = curr_edge.next); // eslint-disable-line no-unused-expressions

    const max_iterations = this.poly.points.length;
    let iter = 0;
    while ( !TraceObject.edgesEqual(curr_edge, target_edge) && iter < max_iterations) {
      iter += 1;
      pts.push(curr_edge.B);
      curr_edge = curr_edge.next;
    }

    pts.length && pointsEqual(pts[pts.length - 1], ixObj2) && pts.pop(); // eslint-disable-line no-unused-expressions

    return pts;
  }

  /**
   * Static method that returns all edges for a given polygon. Edges are linked
   * such that edge.next is the next edge in clockwise order.
   * @param {PIXI.Polygon}  poly
   * @return {SimplePolygonEdge[]}
   */
  static linkedEdges(poly) {
    const iter = poly.iterateEdges();

    let prev_edge = iter.next().value;
    // Need PolygonEdge so can use a version of intersectionSort with nw, se
    prev_edge = new SimplePolygonEdge(prev_edge.A, prev_edge.B);

    const edges = [prev_edge];
    let curr = iter.next();
    while ( !curr.done ) {
      let edge = curr.value;
      edge = new SimplePolygonEdge(edge.A, edge.B);
      prev_edge.next = edge;
      prev_edge = edge;
      edges.push(edge);
      curr = iter.next();
    }
    edges[edges.length - 1].next = edges[0];
    return edges;
  }

  /**
   * Return the array of points for this.shape between two intersections with this.other.
   * Points should indicate how to draw a polygon approximating this.other between the
   * two intersections.
   * @param {Object}  ixObj1    Intersection object
   * @param {Object}  ixObj2    Intersection object
   * @return {Point[]}
   */
  shapePointsBetween(ixObj1, ixObj2) {  // eslint-disable-line no-unused-vars
    console.error("shapePointsBetween|Subclass must implement.");
  }

  /**
   * Determine if, when tracing this.poly clockwise,
   * we would turn clockwise at an intersection of this.poly with
   * this.shape in order to keep tracing this.poly. Assumes
   * both shapes are traced in a clockwise direction.
   * @param {Object}  ixObj   Intersection object
   * @return {Boolean}
   */
  polygonOrientationAtIntersection(ixObj) { // eslint-disable-line no-unused-vars
    console.error("clockwiseForPolygonAtIntersection|Subclass must implement.");
  }

  /**
   * Determine intersections of this.shape, if any, with a provided poly edge.
   * Must be returned in order from edge.A to edge.B.
   * @param {Segment} edge
   * @return {IntersectionObject[]} Array of zero or more intersection objects.
   * Each intersectionObject is an object that must contain at least:
   *    @param {Point}              ix      Intersection between this.poly and this.shape
   *    @param {SimplePolygonEdge}  edge    Linked edge of this.poly that contains the intersection
   *    @param {Boolean}            crosses Whether the poly and shape outlines cross here
   *                                        If the edge B meets, that is not a cross
   */
  findIntersections(edge) {
    const ixObjs = this.findIntersectionsForShape(edge);
    ixObjs.forEach(ixObj => ixObj.edge = edge);
    ixObjs.sort((a, b) => distanceSquared(edge.A, a) - distanceSquared(edge.A, b));
    return ixObjs;
  }

  /**
   * Version of findIntersections used by the specific shape subclass.
   * Subclass must return an array of 0 or more objects. Each object
   * must identify the intersection (ix) and whether the edge crosses (crosses).
   * @param {SimplePolygonEdge} edge
   * @return {Object[]}    Each Object should have at least {ix, crosses}.
   */
  findIntersectionsForShape(edge) { // eslint-disable-line no-unused-vars
    console.error("findIntersectionsForShape|Subclass must implement.");
  }
}

// Used in PolygonTraceObject.clockwiseForPolygonAtIntersection to facilitate switch.
// Represents the four combinations of two booleans.
let TF_OPTIONS = {
  FALSE_FALSE: 0,
  FALSE_TRUE: 1,
  TRUE_FALSE: 2,
  TRUE_TRUE: 3
};


class PolygonTraceObject extends TraceObject {
  constructor(...args) {
    super(...args);
    this.shape.close();
  }

  /**
   * Same as TraceObject.pointsBetween but returns points for this.shape.
   * @param {Object}  ixObj1  Intersection object
   * @param {Object}  ixObj2  Intersection object
   * @return {Points[]}
   */
  shapePointsBetween(ixObj1, ixObj2) {
    // Same as polygonPointsBetween except for the color
    const pts = [];
    let curr_edge = ixObj1.black;
    const target_edge = ixObj2.black;
    if ( TraceObject.edgesEqual(curr_edge, target_edge) ) return [];
    pointsEqual(curr_edge.B, ixObj1) && (curr_edge = curr_edge.next); // eslint-disable-line no-unused-expressions

    const max_iterations = this.shape.points.length;
    let iter = 0;
    while ( !TraceObject.edgesEqual(curr_edge, target_edge) && iter < max_iterations ) {
      iter += 1;
      pts.push(curr_edge.B);
      curr_edge = curr_edge.next;
    }
    pts.length && pointsEqual(pts[pts.length - 1], ixObj2) && pts.pop(); // eslint-disable-line no-unused-expressions

    return pts;
  }

  /**
   * Compare the orientation of the two edges at the intersection to determine
   * what happens if we turn clockwise at the intersection.
   * Handles cases where one or both edges end or start at the intersection.
   * @param {Object}  ixObj Intersection object
   * @return {Boolean}
   */
  polygonOrientationAtIntersection(ixObj) {
    const { edge: red, black } = ixObj;
    const redB = red.B; // The polygon
    const blackB = black.B; // The other shape (other polygon)

    const redBEqual = pointsEqual(ixObj, redB);
    const blackBEqual = pointsEqual(ixObj, blackB);

    switch ( (redBEqual * 2) + blackBEqual ) {
      case TF_OPTIONS.FALSE_FALSE:
        return foundry.utils.orient2dFast(ixObj, blackB, redB);
      case TF_OPTIONS.FALSE_TRUE:
        return foundry.utils.orient2dFast(ixObj, black.next.B, redB);
      case TF_OPTIONS.TRUE_FALSE:
        return foundry.utils.orient2dFast(ixObj, blackB, red.next.B);
      case TF_OPTIONS.TRUE_TRUE:
        return foundry.utils.orient2dFast(ixObj, black.next.B, red.next.B);
    }
  }

  /**
   * Locate all intersections between an edge and this.shape (polygon) using.
   * Intersections must be sorted to maintain the
   * clockwise direction so that tracing encounters intersections in order.
   * (So intersections closer to A are first in the array)
   * @param {SimplePolygonEdge} edge
   * @return {Object[]} Array of Intersection objects.
   */
  findIntersectionsForShape(edge) {
    // Get all intersections between this edge and the shape polygon
    const ixObjs = [];
    const callback_fn = (red, black) => {
      const ix = foundry.utils.lineLineIntersection(red.A, red.B, black.A, black.B);
      ix.black = black; // For PolygonTraceObject.prototype.pointsBetween
      ixObjs.push(ix);
    };
    const blacks = TraceObject.linkedEdges(this.shape);
    findIntersectionsBruteRedBlack([edge], blacks, callback_fn); // Brute appears to do better than sort here, b/c sort with a single segment is too slow
    return ixObjs;
  }
}

class CircleTraceObject extends TraceObject {
  /**
   * @param {Number}  density   Number of points if creating a polygon from the circle
   */
  constructor(poly, shape, { density = 60 } = {}) {
    super(poly, shape);
    this.density = density;
  }

  /**
   * @param {Object}  ixObj1  Intersection object
   * @param {Object}  ixObj2  Intersection object
   * @return {Points[]} Points representing the polygon approximation for the circle
   *   arc between the two intersections.
   */
  shapePointsBetween(ixObj1, ixObj2) {
    const pts = [];
    const padding = PIXI.Circle.pointsForArc(ixObj1, ixObj2, this.shape, { density: this.density });
    for ( const pt of padding ) { pts.push(pt); }
    return pts;
  }

  /**
   * Use fact that turning clockwise moves into the circle when tracing the circle
   * clockwise to determine orientation.
   * @param {Object}  ixObj Intersection object
   * @return {Boolean}
   */
  polygonOrientationAtIntersection(ixObj) {
    return ixObj.bInside ? -1 : 1;
  }

  /**
   * Use foundry.utils.lineCircleIntersection to locate intersections between
   * polygon edge and circle.
   * @param {SimplePolygonEdge} edge
   * @return {Object[]} Array of Intersection objects.
   */
  findIntersectionsForShape(edge) {
    const circle = this.shape;
    const bbox = circle.getBounds();
    if ( !bbox.encountersSegment(edge) ) { return []; }
    const ix_data = foundry.utils.lineCircleIntersection(edge.A, edge.B, circle, circle.radius);
    switch ( ix_data.intersections.length ) {
      case 0: return [];
      case 1:

        return [{
          x: ix_data.intersections[0].x,
          y: ix_data.intersections[0].y,
          bInside: ix_data.bInside
        }];

      case 2:
        return [{
          x: ix_data.intersections[0].x,
          y: ix_data.intersections[0].y,
          bInside: ix_data.bInside
        }, {
          x: ix_data.intersections[1].x,
          y: ix_data.intersections[1].y,
          bInside: ix_data.bInside
        }];
    }
  }
}

/**
 * Similar to Cohen-Sutherland labeling of zones, but here
 * we care about circling around the rectangle.
 * So INSIDE still 0. Can circle from LEFT --> TOP --> RIGHT --> BOTTOM
 * by LEFT << 4 = TOP << 4 = RIGHT << 4 = BOTTOM
 */
let rectSides = {
  INSIDE: 0x0000,
  LEFT: 0x0001,
  TOP: 0x0010,
  RIGHT: 0x0100,
  BOTTOM: 0x1000
};

// Corners of rectangle are combination of the two respective codes for the sides
rectSides.TOPLEFT = rectSides.LEFT | rectSides.TOP;
rectSides.BOTTOMLEFT = rectSides.LEFT | rectSides.BOTTOM;
rectSides.TOPRIGHT = rectSides.RIGHT | rectSides.TOP;
rectSides.BOTTOMRIGHT = rectSides.RIGHT | rectSides.BOTTOM;

class RectangleTraceObject extends TraceObject {
  /**
   * Locate the side for this point.
   * @param {Point}  p
   * @return {rectSides} Binary code indicating the side.
   */
  _side(p) {
    const rect = this.shape;
    let code = rectSides.INSIDE;
    if ( p.x.almostEqual(rect.left) ) {
      code |= rectSides.LEFT;
    } else if ( p.x.almostEqual(rect.right) ) {
      code |= rectSides.RIGHT;
    }

    if ( p.y.almostEqual(rect.y) ) {
      code |= rectSides.TOP;
    } else if ( p.y.almostEqual(rect.bottom) ) {
      code |= rectSides.BOTTOM;
    }

    // For tracing around a rectangle, can treat ix at a corner as being part of the side.
    // Tracing clockwise, so topleft should be top so points will include topright corner.
    // Etc. for other corners.
    switch ( code ) {
      case rectSides.TOPLEFT: code = rectSides.TOP; break;
      case rectSides.TOPRIGHT: code = rectSides.RIGHT; break;
      case rectSides.BOTTOMRIGHT: code = rectSides.BOTTOM; break;
      case rectSides.BOTTOMLEFT: code = rectSides.LEFT; break;
    }

    return code;
  }

  /**
   * Next side assuming clockwise rotation around the rectangle.
   * @param {rectSide}  side
   * @return {rectSide}
   */
  _nextSide(side) {
    if ( side === rectSides.BOTTOM ) { return rectSides.LEFT; }
    return side << 4;
  }

  /**
   * Coordinates for the clockwise corner of a given side.
   * e.g., for the left side, return the top left corner
   * @param {rectSide}  side
   * @param {Point}
   */
  clockwiseCornerForSide(side) {
    const rect = this.shape;
    switch ( side ) {
      case rectSides.LEFT: return { x: rect.left, y: rect.top };
      case rectSides.TOP: return { x: rect.right, y: rect.top };
      case rectSides.RIGHT: return { x: rect.right, y: rect.bottom };
      case rectSides.BOTTOM: return { x: rect.left, y: rect.bottom };
    }
  }

  /**
   * Identify points (rectangle corners) between two intersections, moving clockwise
   * around the rectangle.
   * @param {Object}  ixObj1    Intersection object
   * @param {Object}  ixObj2    Intersection object
   * @return {Point[]}
   */
  shapePointsBetween(ixObj1, ixObj2) {
    // Locate which side the first intersection is on, and trace around clockwise to the
    // side of the second intersection.
    // Handle points very near the side and points very near the corners.
    const side1 = this._side(ixObj1);
    if ( !side1 ) {
      console.error("RectangleTraceObject|pointsBetween ixObj1 not on the rectangle.");
      return [];
    }

    const side2 = this._side(ixObj2);
    if ( !side2 ) {
      console.error("RectangleTraceObject|pointsBetween ixObj2 not on the rectangle.");
      return [];
    }

    let curr_side = side1;
    if ( curr_side === side2 ) return [];
    pointsEqual(this.clockwiseCornerForSide(curr_side), ixObj1) && (curr_side = this._nextSide(curr_side)); // eslint-disable-line no-unused-expressions

    const pts = [];
    while ( curr_side !== side2 ) {
      pts.push(this.clockwiseCornerForSide(curr_side));
      curr_side = this._nextSide(curr_side);
    }

    pts.length && pointsEqual(pts[pts.length - 1], ixObj2) && pts.pop(); // eslint-disable-line no-unused-expressions

    return pts;
  }

  polygonOrientationAtIntersection(ixObj) {
    const bInside = this.shape.contains(ixObj.edge.B.x, ixObj.edge.B.y);
    return bInside ? -1 : 1;
  }

  findIntersectionsForShape(edge) {
    const rect = this.shape;
    if ( !rect.lineSegmentIntersects(edge.A, edge.B) ) { return []; }
    return rect.lineSegmentIntersection(edge.A, edge.B);
  }
}

class LimitedAngleTraceObject extends TraceObject {

  /**
   * @param {Object}  ixObj1  Intersection object
   * @param {Object}  ixObj2  Intersection object
   * @return {Points[]} Points representing the polygon approximation for the limited
   *   angle between the two intersections.
   */
  shapePointsBetween(ixObj1, ixObj2) {
    const pts = [];
    const la = this.shape;
    const rMin_ix = la.rMin_ix;
    const rMax_ix = la.rMax_ix;

    switch ( (ixObj1.is_max * 2) + ixObj2.is_max ) {
      case TF_OPTIONS.FALSE_FALSE:
        // Path: rMin --> rMin or rMin --> canvas --> rMax --> rMin
        if ( distanceSquared(rMin_ix, ixObj1)
          < distanceSquared(rMin_ix, ixObj2) ) { return []; }
        if ( !pointsEqual(rMin_ix, ixObj1) ) { pts.push(rMin_ix); }
        pts.push(...la.canvas_points);
        pts.push(rMax_ix, la.origin);
        break;

      case TF_OPTIONS.FALSE_TRUE:
        // Path: rMin --> canvas --> rMax
        if ( !pointsEqual(rMin_ix, ixObj1) ) { pts.push(rMin_ix); }
        pts.push(...la.canvas_points);
        pts.push(rMax_ix);
        break;

      case TF_OPTIONS.TRUE_FALSE:
        // Path: rMax --> rMin
        if ( !pointsEqual(la.origin, ixObj1) ) { pts.push(la.origin); }
        break;

      case TF_OPTIONS.TRUE_TRUE:
        // Path: rMax --> rMax or rMax --> rMin --> canvas --> rMax
        if ( distanceSquared(rMax_ix, ixObj1)
          < distanceSquared(rMax_ix, ixObj2) ) { return []; }
        if ( !pointsEqual(la.origin, ixObj1) ) { pts.push(la.origin); }
        pts.push(rMin_ix);
        pts.push(...la.canvas_points);
        pts.push(rMax_ix);
        break;
    }

    // If the intersection is at an endpoint, drop it
    if ( pts.length > 0 && pointsEqual(pts[pts.length - 1], ixObj2) ) { pts.pop(); }

    return pts;
  }

  /**
   * @param {Object}  ixObj Intersection object
   * @return {Boolean}
   */
  polygonOrientationAtIntersection(ixObj) {
    return this.shape.containsPoint(ixObj.edge.B) ? -1 : 1;
  }

  /**
   * The LimitedAngle extends to the canvas edge, which means we only really care
   * about the minRay and maxRay intersections.
   * union: Canvas edge is the boundary
   * intersect: polygon edge is the boundary
   * @param {SimplePolygonEdge} edge
   * @return {Object[]} Array of Intersection objects.
   */
  findIntersectionsForShape(edge) {
    const la = this.shape;
    const rMin = la.rMin;
    const rMax = la.rMax;

    const intersects_rMin = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMin.A, rMin.B);
    const intersects_rMax = foundry.utils.lineSegmentIntersects(edge.A, edge.B, rMax.A, rMax.B);

    let ix_min;
    let ix_max;
    intersects_rMin && (ix_min = foundry.utils.lineSegmentIntersection(edge.A, edge.B, rMin.A, rMin.B)); // eslint-disable-line no-unused-expressions
    intersects_rMax && (ix_max = foundry.utils.lineSegmentIntersection(edge.A, edge.B, rMax.A, rMax.B)); // eslint-disable-line no-unused-expressions

    switch ( (intersects_rMin * 2) + intersects_rMax ) {
      case TF_OPTIONS.FALSE_FALSE: return [];
      case TF_OPTIONS.FALSE_TRUE:
        ix_max.is_max = true;
        return [ix_max];

      case TF_OPTIONS.TRUE_FALSE:
        ix_min.is_max = false;
        return [ix_min];

      case TF_OPTIONS.TRUE_TRUE:
        ix_min.is_max = false;
        ix_max.is_max = true;
        return [ix_min, ix_max];
    }
  }
}
