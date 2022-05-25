/* globals
PIXI,
foundry,
Ray,
ClockwiseSweepPolygon,
game
*/
"use strict";

import { findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { LimitedAngleSweepPolygon } from "./LimitedAngle.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

/*
Trace a polygon in the clockwise direction. At each intersection with the other shape,
select the clockwise direction (intersect) or counterclockwise direction (union). Repeat
at each intersection. The traced object will be the intersection or union if the
shape shares the center point or origin with the polygon.
*/

export function _traceShapes(red, black, { union = true, density = 60, test_all_ix = false } = {}) {
  const drawing = game.modules.get("testccw").api.drawing;

  drawing.clearDrawings();
  drawing.drawShape(red, { color: drawing.COLORS.red });
  drawing.drawShape(black, { color: drawing.COLORS.black });

  const redTraceObject = TraceObject.buildTraceObject(red, black);
  const blackTraceObject = TraceObject.buildTraceObject(black, red);

  let short_circuit = redTraceObject.shortCircuit(union);
  short_circuit ||= blackTraceObject.shortCircuit(union);
  if ( short_circuit ) return short_circuit;

  const turn_clockwise = !union;

  const ixObjs = redTraceObject.ixObjects(red, black);

  // Draw the intersections
  ixObjs.map(ixObj => drawing.drawPoint(ixObj.ix, { color: drawing.COLORS.blue, alpha: .2 }));

  // Repeat the last object to close the points at the end
  ixObjs.push(ixObjs[0]);

  // First intersection is a one-off to get us started.
  let last_ixObj = ixObjs.shift();
  const pts = [last_ixObj.ix];

  // Need to first determine if we are switching to red or black at the initial
  // intersection.
  const red_clockwise = redTraceObject.isClockwiseAtIntersection(last_ixObj);
  let is_tracing_red = !(turn_clockwise ^ red_clockwise);
  console.log(`tracing ${is_tracing_red ? "red" : "black"} from ${last_ixObj.ix.x},${last_ixObj.ix.y}; `);
  drawing.drawPoint(last_ixObj.ix, { color: drawing.COLORS.green });

  for ( const ixObj of ixObjs ) {
    let was_tracing_red = is_tracing_red;
    is_tracing_red = ixObj.crosses && !was_tracing_red; // Flip if we cross at ix.
    let switch_shapes = was_tracing_red ^ is_tracing_red;

    if ( switch_shapes ) {
      console.log(`${was_tracing_red ? "Red" : "Black"} --> ${was_tracing_red ? "Black" : "Red"} at ${ixObj.ix.x},${ixObj.ix.y}`);
      drawing.drawPoint(ixObj.ix, { color: drawing.COLORS.blue, alpha: .5 });

      let traceObj = was_tracing_red ? redTraceObject : blackTraceObject;
      let padding = traceObj.pointsBetween(last_ixObj, ixObj);
      padding.forEach(pt => drawing.drawPoint(pt, { color: drawing.COLORS.gray, alpha: .5 }));
      padding.length && pts.push(...padding); // eslint-disable-line no-unused-expressions

      last_ixObj = ixObj;
      pts.push(last_ixObj.ix);
    }
  }

  return new PIXI.Polygon(pts);
}

// Because JS does not do multiple dispatch, we are faking it here.
// ixObjects is a 2-D array representing the shape1, shape2 arguments to an
// ixObjects function. by calling ixObjects[shape1.constructor][shape2.constructor], we get the function
// for that combination of objects.
let ixObjects = {};
ixObjects[PIXI.Polygon] = {};
ixObjects[PIXI.Circle] = {};
ixObjects[PIXI.Rectangle] = {};
ixObjects[LimitedAngleSweepPolygon] = {};

ixObjects[PIXI.Polygon][PIXI.Polygon] = ixObjectsPolyPoly;
ixObjects[PIXI.Polygon][PIXI.Circle] = ixObjectsPolyCircle;
ixObjects[PIXI.Polygon][PIXI.Rectangle] = ixObjectsPolyRectangle;
ixObjects[PIXI.Polygon][LimitedAngleSweepPolygon] = () => { console.error("ixObjectsArr[PIXI.Polygon][LimitedAngleSweepPolygon] undefined."); };

ixObjects[PIXI.Circle][PIXI.Circle] = ixObjectsCircleCircle;
ixObjects[PIXI.Circle][PIXI.Polygon] = ixObjectsCirclePoly;
ixObjects[PIXI.Circle][PIXI.Rectangle] = ixObjectsCircleRectangle;
ixObjects[PIXI.Circle][LimitedAngleSweepPolygon] = () => { console.error("ixObjectsArr[PIXI.Circle][LimitedAngleSweepPolygon] undefined."); };

ixObjects[PIXI.Rectangle][PIXI.Rectangle] = () => { console.error("ixObjectsArr[PIXI.Rectangle][PIXI.Rectangle] undefined."); };
ixObjects[PIXI.Rectangle][PIXI.Circle] = ixObjectsRectangleCircle;
ixObjects[PIXI.Rectangle][PIXI.Polygon] = ixObjectsRectanglePoly;
ixObjects[PIXI.Rectangle][LimitedAngleSweepPolygon] = () => { console.error("ixObjectsArr[PIXI.Rectangle][LimitedAngleSweepPolygon] undefined."); };

ixObjects[LimitedAngleSweepPolygon][LimitedAngleSweepPolygon] = () => { console.error("ixObjectsArr[LimitedAngleSweepPolygon][LimitedAngleSweepPolygon] undefined."); };
ixObjects[LimitedAngleSweepPolygon][PIXI.Circle] = () => { console.error("ixObjectsArr[LimitedAngleSweepPolygon][PIXI.Circle] undefined."); };
ixObjects[LimitedAngleSweepPolygon][PIXI.Polygon] = () => { console.error("ixObjectsArr[LimitedAngleSweepPolygon][PIXI.Rectangle] undefined."); };
ixObjects[LimitedAngleSweepPolygon][PIXI.Rectangle] = () => { console.error("ixObjectsArr[LimitedAngleSweepPolygon][PIXI.Rectangle] undefined."); };

/*
Need two functions to use trace:
1. pointsBetween. For given intersection objects, return all the points between.
   Polygons will need to know the edge and use edge.next to efficiently locate points.
   Alternatively, could store the first point, like edge.B, and then look-up the index.
   But polygons do not natively store point objects, so this may be more complicated
   and slower before.
   Other shapes should be able to determine points from just the intersections.

2. findIntersections. For given two shapes, where do they intersect?
   For a polygon, will need the edges. See (1)
*/

class TraceObject {
  constructor(shape1, shape2) {
    this.ixObjects = ixObjects[shape1.constructor][shape2.constructor];
    this.shape = shape1;
    this.other = shape2;
  }

  static buildTraceObject(shape1, shape2) {
    switch ( shape1.constructor ) {
      case PIXI.Polygon: return new TraceObjectPolygon(shape1, shape2);
      case PIXI.Circle: return new TraceObjectCircle(shape1, shape2);
      case PIXI.Rectangle: return new TraceObjectRectangle(shape1, shape2);
      case LimitedAngleSweepPolygon: return new TraceObjectLimitedAngle(shape1, shape2);
    }
    return new TraceObject(shape1, shape2);
  }

  /**
   * Return the array of points for this.shape between two intersections with this.shape.
   * Points should indicate how to draw a polygon approximating this.shape between the
   * two intersections.
   * @param {Object}  ixObj1    Intersection object
   * @param {Object}  ixObj2    Intersection object
   * @return {Point[]}
   */
  pointsBetween(ixObj1, ixObj2) {  // eslint-disable-line no-unused-vars
    console.error("pointsBetween|Subclass must implement.");
  }

  /**
   * Determine if, tracing this.shape, we would turn clockwise at an intersection of
   * this.shape with another shape in order to keep tracing this.shape. Assumes
   * both shapes are traced in a clockwise direction.
   * @param {Object}  ixObj   Intersection object
   * @return {Boolean}
   */
  isClockwiseAtIntersection(ixObj) { // eslint-disable-line no-unused-vars
    console.error("isClockwiseAtIntersection|Subclass must implement.");
  }

  /**
   * If it is possible to quickly intersect or union this.shape with this.other,
   * do so and return their union or intersection, respectively.
   * Otherwise, return false indicating it is not possible.
   * For example, intersecting two PIXI.Rectangles is straightforward and results in
   * another PIXI.Rectangle.
   * @param {Boolean} union   True if union; false if intersection is desired.
   * @return {Boolean|Object}   False if not possible; object such as PIXI.Polygon otherwise.
   */
  shortCircuit(union) { return false; } // eslint-disable-line no-unused-vars
}


// Given two booleans A AND B, label the combinations using the formula
// 2 * A + B.
// Used in a switch statement to replace multi-level if statements.
let TF_OPTIONS = {
  FALSE_FALSE: 0,
  FALSE_TRUE: 1,
  TRUE_FALSE: 2,
  TRUE_TRUE: 3
};

class TraceObjectPolygon extends TraceObject {
  pointsBetween(ixObj1, ixObj2) {
    const pts = [];
    const color = (!ixObj1.red_shape || ixObj1.red_shape === this.shape) ? "red" : "black";

    let curr_edge = ixObj1[color];
    while ( curr_edge !== ixObj2[color] ) {
      pts.push(curr_edge.B);
      curr_edge = curr_edge.next;
    }
    return pts;
  }

  isClockwiseAtIntersection(ixObj) {
    const color = (!ixObj.red_shape || ixObj.red_shape === this.shape) ? "red" : "black";
    const other = color === "red" ? "black" : "red";

    const colorBEqual = ixObj.ix.x === ixObj[color].B.x && ixObj.ix.y === ixObj[color].B.y;
    const otherBEqual = ixObj.ix.x === ixObj[other].B.x && ixObj.ix.y === ixObj[other].B.y;

    let orient;
    switch ( (colorBEqual * 2) + otherBEqual ) {
      case TF_OPTIONS.FALSE_FALSE:
        orient = foundry.utils.orient2dFast(ixObj.ix, ixObj[color].B, ixObj[other].B); break;
      case TF_OPTIONS.FALSE_TRUE:
        orient = foundry.utils.orient2dFast(ixObj.ix, ixObj[color].B, ixObj[other].next.B); break;
      case TF_OPTIONS.TRUE_FALSE:
        orient = foundry.utils.orient2dFast(ixObj.ix, ixObj[color].next.B, ixObj[other].B); break;
      case TF_OPTIONS.TRUE_TRUE:
        orient = foundry.utils.orient2dFast(ixObj.ix, ixObj[color].next.B, ixObj[other].next.B); break;
    }

    return orient > 0; // If ix --> color.B --> other.B is ccw, then color.B must be cw
  }
}

class TraceObjectCircle extends TraceObject {
  pointsBetween(ixObj1, ixObj2) {
    const pts = [];
    const padding = paddingPoints(ixObj1.ix, ixObj2.ix, this.shape, { density: this.density });
    for ( const pt of padding ) {
      pts.push(pt);
    }
    return pts;
  }

  /**
   * If two circles, union or intersection easily defined using polygons and padding.
   * Only max two intersections to deal with
   */
  shortCircuit(union) {
    const ixs = findCircleCircleIntersections(this.shape, this.other);
    if ( ixs.length === 0) {
      return union ? [this.shape, this.other] : new PIXI.Circle();
    }

    if ( ixs.length === 1 ) {
      // Ix is tangent. Intersection is the point.
      return union ? [this.shape, this.other] : ixs[0];
    }

    // Two intersections. Construct polygon.
    const orient0 = foundry.utils.orient2dFast(this.shape, this.other, ixs[0]);
    const orient1 = foundry.utils.orient2dFast(this.shape, this.other, ixs[1]);
    const pts = [ixs[0]];
    if ( union ) {
      if ( orient0 > 0 ) {  // CCW
        pts.push(paddingPoints(ixs[0], ixs[1], this.other));
      } else {
        pts.push(paddingPoints(ixs[0], ixs[1], this.shape));
      }

      if ( orient1 > 0 ) { // CCW
        pts.push(paddingPoints(ixs[1], ixs[0], this.other));
      } else {
        pts.push(paddingPoints(ixs[1], ixs[0], this.shape));
      }
    } else { // Intersection
      if ( orient0 > 0 ) { // CCW
        pts.push(paddingPoints(ixs[0], ixs[1], this.shape));
      } else {
        pts.push(paddingPoints(ixs[0], ixs[1], this.other));
      }

      if ( orient1 > 0 ) { // CCW
        pts.push(paddingPoints(ixs[1], ixs[0], this.shape));
      } else {
        pts.push(paddingPoints(ixs[1], ixs[0], this.other));
      }
    }
    pts.push(ixs[1]);

    return new PIXI.Polygon(pts);
  }
}


/**
 * Similar to Cohen-Sutherland labeling of zones, but here
 * we care about circling around the rectangle.
 * So INSIDE still 0. Can circle from LEFT --> TOP --> RIGHT --> BOTTOM
 * by LEFT << 4 = TOP << 4 = RIGHT << 4 = BOTTOM
 */
let rectZones = {
  INSIDE: 0x0000,
  LEFT: 0x0001,
  TOP: 0x0010,
  RIGHT: 0x0100,
  BOTTOM: 0x1000
};

rectZones.TOPLEFT = rectZones.LEFT | rectZones.TOP;
rectZones.BOTTOMLEFT = rectZones.LEFT | rectZones.BOTTOM;
rectZones.TOPRIGHT = rectZones.RIGHT | rectZones.TOP;
rectZones.BOTTOMRIGHT = rectZones.RIGHT | rectZones.BOTTOM;

class TraceObjectRectangle extends TraceObject {
  _zone(p) {
    let code = rectZones.INSIDE;
    if ( p.x.almostEqual(this.left) ) {
      code |= rectZones.LEFT;
    } else if ( p.x.almostEqual(this.right) ) {
      code |= rectZones.RIGHT;
    }

    if ( p.y.almostEqual(this.y) ) {
      code |= rectZones.TOP;
    } else if ( p.y.almostEqual(this.bottom) ) {
      code |= rectZones.BOTTOM;
    }

    // For tracing around a rectangle, can treat ix at a corner as being part of the side.
    // Tracing clockwise, so topleft should be top so points will include topright corner.
    // Etc. for other corners.
    if ( code === rectZones.TOPLEFT ) {
      code = rectZones.TOP;
    } else if ( code === rectZones.TOPRIGHT ) {
      code = rectZones.RIGHT;
    } else if ( code === rectZones.BOTTOMRIGHT ) {
      code = rectZones.BOTTOM;
    } else if ( code === rectZones.BOTTOMLEFT ) {
      code = rectZones.LEFT;
    }

    return code;
  }

  _nextZone(zone) {
    if ( zone === rectZones.BOTTOM ) { return rectZones.LEFT; }
    return zone << 4;
  }

  coordsForZone(zone) {
    switch ( zone ) {
      case rectZones.LEFT: return { x: this.shape.left, y: this.shape.top };
      case rectZones.TOP: return { x: this.shape.right, y: this.shape.top };
      case rectZones.RIGHT: return { x: this.shape.right, y: this.shape.bottom };
      case rectZones.BOTTOM: return { x: this.shape.left, y: this.shape.bottom };
    }
  }

  pointsBetween(ixObj1, ixObj2) {
    // Locate which side the first intersection is on, and trace around clockwise to the
    // side of the second intersection.
    // Handle points very near the side and points very near the corners.
    const zone1 = this._zone(ixObj1.ix);
    if ( !zone1 ) {
      console.error("TraceObjectRectangle|pointsBetween ixObj1 not on the rectangle.");
      return [];
    }

    const zone2 = this._zone(ixObj2.ix);
    if ( !zone2 ) {
      console.error("TraceObjectRectangle|pointsBetween ixObj2 not on the rectangle.");
      return [];
    }

    let curr_zone = zone1;
    const pts = [];
    while ( curr_zone !== zone2 ) {
      pts.push(this.coordsForZone(curr_zone));
      curr_zone = this._nextZone(curr_zone);
    }

    return pts;
  }

  /**
   * Provide a faster intersection method for two rectangles, which will
   * always return a smaller rectangle (or empty rectangle).
   * @param {Boolean} union   Is this a union or an intersection?
   * @return {false|PIXI.Rectangle}
   */
  shortCircuit(union) {
    if ( !union || !(this.other instanceof PIXI.Rectangle )) { return false; }
    return this.shape.rectangleIntersection(this.other);
  }
}


// The ixObject:
// ix: Intersection point
// clockwise_remains: When tracing clockwise along the red shape,
//                   will turning clockwise at the intersection keep you on the red shape?
// edge: Current red edge (polygons only)
// edge2: Current black edge (polygons only)


function ixObjectsPolyPoly(red, black) {
  const reds = polyLinkedEdges(red);
  const blacks = polyLinkedEdges(black);
  const out = [];
  const red_shape = red;

  const callback_fn = (red, black) => {
    const ix = foundry.utils.lineLineIntersection(red.A, red.B, black.A, black.B);
    // Determine if the red edge actually crosses black, or vice-versa.
    // In most cases, they cross, forming an X.
    // But the intersection is at an endpoint, then they may or may not cross,
    // depending on what happens with the next edge.
    // Only check the B endpoints, b/c B endpoints will be A endpoints in
    // a different iteration

    let crosses = true;
    if ( ix.x === red.B && ix.y === red.B.y ) {
      // If red.A is on the same side of black as red.next.B, then
      // red just "bounced" off black edge.
      const orientA = foundry.utils.orient2dFast(black.A, black.B, red.A);
      const orientB = foundry.utils.orient2dFast(black.A, black.B, red.next.B);
      crosses = (orientA * orientB) < 0; // If both + or both -, mult will be +.
    } else if ( ix.x === black.B.x && ix.y === black.B.y ) {
      const orientA = foundry.utils.orient2dFast(red.A, red.B, black.A);
      const orientB = foundry.utils.orient2dFast(red.A, red.B, black.next.B);
      crosses = (orientA * orientB) < 0;
    }

    out.push({
      ix,
      crosses,
      red, // For TraceObjectPolygon.prototype.pointsBetween
      black, // For TraceObjectPolygon.prototype.pointsBetween
      red_shape // // For TraceObjectPolygon.prototype.pointsBetween to distinguish shapes
    });
  };

  findIntersectionsSortRedBlack(reds, blacks, callback_fn);
  return out;
}


function ixObjectsPolyCircle(poly, circle) {
  const edges = polyLinkedEdges(poly);
  const bbox = circle.getBounds();
  const out = [];
  for ( const edge in edges ) {
    if ( !bbox.encountersSegment(edge) ) continue;
    const ix_data = foundry.utils.lineCircleIntersection(edge.A, edge.B, circle, circle.radius);
    for ( let i = 0; i < ix_data.intersections.length; i += 1 ) {
      out.push({
        ix: ix_data.intersections[i],
        clockwise_remains: i === 1 ? false : !ix_data.aInside,
        red: edge
      });
    }
  }
  return out;
}

function ixObjectsCirclePoly(circle, poly) { return ixObjectsPolyCircle(poly, circle); }

function ixObjectsCircleCircle(red, black) {
  const out = [];

  const ixs = findCircleCircleIntersections(red, black);
  for ( const ix of ixs ) {

    // Clockwise is true if moving clockwise from the intersection will continue to trace
    // this shape.
    // Depends on which intersection it is.
    // if tangent, we know the answer
    if ( ixs.length === 1 ) { return [{ ix, clockwise: true }]; }

    const orient = foundry.utils.orient2dFast(red, black, ix);
    if ( orient === 0 ) {
      console.warn("ixObjectsCircleCircle|Orientation is 0 but points not tangent.");
    }

    // If orientation is 0, clockwise is true. (should only happen with tangent)
    // (ix is a tangent; continue around the circle)
    const clockwise_remains = (orient === 0) || (orient > 0);

    out.push({ ix, clockwise_remains });
  }
  return out;
}

function ixObjectsRectangleCircle(rect, circle) {
  // Rect only has 4 edges, so reasonably simple to make it a polygon
  // and find intersections with circle that way.
  const poly = rect.toPolygon();
  return ixObjectsPolyCircle(poly, circle);
}

function ixObjectsCircleRectangle(circle, rect) {
  const poly = rect.toPolygon();
  return ixObjectsPolyCircle(poly, circle);
}


function ixObjectsPolyRectangle(poly, rect) {
  const edges = polyLinkedEdges(poly);
  const out = [];
  for ( const edge in edges ) {
    if ( !rect.lineSegmentIntersects(edge) ) continue;
    const ix = rect.lineSegmentIntersection(edge.A, edge.B);
    if ( ix ) {
      // It is always a CCW turn to go from rectangle to outside rectangle, when
      // moving clockwise around the rectangle.
      const a_inside = rect.contains(edge.A.x, edge.A.y);
      const b_inside = rect.contains(edge.B.x, edge.B.y);
      out.push({
        ix,
        clockwise_remains: b_inside || !a_inside, // In case b is on the edge of the rectangle
        red: edge
      });
    }
  }
  return out;
}

function ixObjectsRectanglePoly(rect, poly) { return ixObjectsPolyRectangle(poly, rect); }

/**
 * Retrieve polygon edges but add a link to the next edge.
 * @param {PIXI.Polygon}  poly
 * @return {Edge}  Object with points A and B.
 */
function polyLinkedEdges(poly) {
  const iter = poly.iterateEdges();

  let prev_edge = iter.next().value;
  // Need PolygonEdge so can use intersectionSort (nw, se)
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
 * http://math.stackexchange.com/a/1367732
 * @param {PIXI.Circle}   red
 * @param {PIXI.Circle}   black
 * @param {Point[]}       0, 1, or 2 points of intersection.
 */
function findCircleCircleIntersections(red, black) {
  const x1 = red.x;
  const y1 = red.y;
  const r1 = red.radius;
  const r1_2 = Math.pow(r1, 2);

  const x2 = black.x;
  const y2 = black.y;
  const r2 = black.radius;

  const dx = x1 - x2;
  const dy = y1 - y2;

  const d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  const l = (r1_2 - Math.pow(r2, 2) + Math.pow(d, 2)) / (2 * d);
  const h = Math.sqrt(r1_2 - Math.pow(l, 2));

  if ( d === 0 ) { return []; }

  const ld = l / d;
  const hd = h / d;
  const dx2 = x2 - x1;
  const dy2 = y2 - y1;

  const out1 = { x: (ld * dx2) + (hd * dy2) + x1, y: (ld * dy2) - (hd * dx2) + y1 };
  const out2 = { x: (ld * dx2) - (hd * dy2) + x1, y: (ld * dy2) + (hd * dx2) + y1 };

  if ( out1.x.almostEqual(out2.x) && out1.y.almostEqual(out2.y) ) {
    return [out1];
  }

  return [out1, out2];
}


/**
 * "Pad" by adding points representing a circle arc between fromPoint and toPoint.
 * Relies on ClockwiseSweepPolygon.prototype._getPaddingPoints.
 * @param {Point} fromPt
 * @param {Point} toPoint
 * @param {Point} center    Center of the circle
 * Options:
 * @param {number} density          How much padding (polygon points) to use?
 * @return {number[]} Points array, in format [x0, y0, x1, y1, ...]
 */
function paddingPoints(fromPoint, toPoint, center, { density = 60 } = {}) {
  const obj = { config: { density }};
  const r0 = new Ray(center, fromPoint);
  const r1 = new Ray(center, toPoint);

  return ClockwiseSweepPolygon.prototype._getPaddingPoints.call(obj, r0, r1);
}
