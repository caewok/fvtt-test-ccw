/* globals
PIXI,
foundry,
Ray,
ClockwiseSweepPolygon,
*/

'use strict';

/*
Intersect or union a polygon with a circle without immediately converting circle to a polygon. Similar method to that of SimplePolygon._combine. Start at intersection point, tracing polygon or circle. At each intersection point, pick the clockwise (intersect) or counterclockwise (union) direction. Use padding to fill the circle to the next intersection.

Exported methods are added to PIXI.Circle in PIXICircle.js.
*/

/**
 * Union of this circle with a polygon.
 * @param {PIXI.Polygon} poly
 * Options:
 * @param {number} density    How many points to use when converting circle arcs to
 *                            a polygon.
 * @return {PIXI.Polygon}
 */
export function circle_union(poly, { density = 60 } = {}) {
  // when tracing a polygon in the clockwise direction:
  // union: pick the counter-clockwise choice at intersections
  // intersect: pick the clockwise choice at intersections
  return _combine(poly, this, { clockwise: false, density });
}

/**
 * Intersect of this circle with a polygon.
 * @param {PIXI.Polygon} poly
 * @param {number} density    How many points to use when converting circle arcs to
 *                            a polygon.
 * @return {PIXI.Polygon}
 */
export function circle_intersect(poly, { density = 60 } = {}) {
  const out = _combine(poly, this, { clockwise: true, density });

  // intersection of two convex polygons is convex
  // circle is always convex
  // don't re-run convexity but add parameter if available
  if(poly._isConvex) { out._isConvex = true; }

  return out;
}

/**
 * Helper for union and intersect methods.
 * @param {PIXI.Polygon} poly
 * @param {PIXI.Circle}  circle
 * Options:
 * @param {boolean} clockwise  True if the trace should go clockwise at each
 *                             intersection; false to go counterclockwise.
 * @param {number} density    How many points to use when converting circle arcs to
 *                            a polygon.
 * @return {PIXI.Polygon}
 * @private
 */
function _combine(poly, circle, { clockwise = true, density = 60 } = {}) {
  const pts = _tracePolygon(poly, circle, { clockwise, density });

  if(pts.length === 0) {
    // if no intersections, then either the polygons do not overlap (return null)
    // or one encompasses the other (return the one that encompasses the other)
    const union = !clockwise;
    if(_circleEncompassesPolygon(circle, poly))
      return union ? circle.toPolygon({ density }) : poly;

    // already know that the circle does not contain any polygon points
    // if circle center is within polygon, polygon must therefore contain the circle.
    // (recall that we already found no intersecting points)
    if(poly.contains(circle.x, circle.y))
      return union ? poly : circle.toPolygon({ density });

    return null;
  }

  const new_poly = new PIXI.Polygon(pts);

  // algorithm always outputs a clockwise polygon
  new_poly._isClockwise = true;
  return new_poly;
}

/**
 * Test whether circle could encompass the polygon
 * Only certain to encompass if you already know that the two do not intersect.
 * Equivalent to SimplePolygon.prototype.encompassesPolygon.
 * @param {PIXI.Circle}   circle
 * @param {PIXI.Polygon}  poly
 * @return {boolean}  True if circle could possibly encompass the polygon.
 */
function _circleEncompassesPolygon(circle, poly) {
  const iter = poly.iteratePoints();
  for(const pt of iter) {
    if(!circle.contains(pt.x, pt.y)) return false;
  }
  return true;
}


/**
 * Trace around a polygon in the clockwise direction. At each intersection with
 * the second polygon, select either the clockwise or counterclockwise direction
 * (based on the option). Return each vertex or intersection point encountered, as
 * well as padding points for the circle.
 *
 * Mark each time the trace jumps from the polygon to the circle, or back.
 * When returning to the polygon, add padding points representing the circle arc
 * from the starting intersection to this ending intersection.
 *
 * @param {PIXI.Circle}   circle
 * @param {PIXI.Polygon}  poly
 * @param {boolean} clockwise   True if the trace should go clockwise at each
 *                              intersection; false to go counterclockwise.
 * @param {number} density      How many points to use when converting circle arcs to
 *                              a polygon.
 * @return {number[]} Points array, in format [x0, y0, x1, y1, ...]
 */
export function _tracePolygon(poly, circle, { clockwise = true, density = 60 } = {}) {
  poly.close();
  if(!poly.isClockwise) poly.reverse();

  let center = { x: circle.x, y: circle.y };
  let radius = circle.radius;

  // store the starting data
  let ix_data = {
    pts: [],
    clockwise,
    density,
    is_tracing_segment: false,
    // things added later
    ix: undefined,
    circle_start: undefined,
    aInside: undefined,
    bInside: undefined,
  };

  let edges = [...poly.iterateEdges()];
  let ln = edges.length;
  let max_iterations = ln * 2;
  let first_intersecting_edge_idx = -1;
  let circled_back = false;
  for(let i = 0; i < max_iterations; i += 1) {
    if(circled_back) { break; } // back to first intersecting edge



    let edge_idx = i % ln;
    let edge = edges[edge_idx];

//     console.log(`${i}: ${edge.A.x},${edge.A.y}|${edge.B.x},${edge.B.y} ${ix_data.is_tracing_segment ? "tracing" : "not tracing"} segment`);

    if(edge_idx === first_intersecting_edge_idx) { circled_back = true; }

    let ixs_result = foundry.utils.lineCircleIntersection(edge.A, edge.B, center, radius);
//     console.log(`\t${ixs_result.intersections.length} intersections.`);

    // round ix for testing to compare to original
//     ixs_result.intersections = ixs_result.intersections.map(ix => {
//       return { x: Math.round(ix.x), y: Math.round(ix.y) };
//     });

    if(ixs_result.intersections.length == 2) {
      if(first_intersecting_edge_idx == -1) {
        first_intersecting_edge_idx = edge_idx;
        ix_data.is_tracing_segment = true;
      }

      // we must have a outside --> i0 ---> i1 ---> b outside
      ix_data.ix = ixs_result.intersections[0];
      ix_data.aInside = ixs_result.aInside;
      ix_data.aInside = ixs_result.aInside;

      processIntersection(circle, edge, ix_data, false);

      ix_data.ix = ixs_result.intersections[1];
      processIntersection(circle, edge, ix_data, true);

    } else if(ixs_result.intersections.length === 1) {
      if(first_intersecting_edge_idx === -1) {
        first_intersecting_edge_idx = edge_idx;
        ix_data.is_tracing_segment = true;
      }

      ix_data.ix = ixs_result.intersections[0];
      ix_data.aInside = ixs_result.aInside;
      ix_data.bInside = ixs_result.bInside;

      processIntersection(circle, edge, ix_data, false);
    }

    if(ix_data.is_tracing_segment && !circled_back) {
      // add the edge B vertex to points array
//       console.log(`\tAdding edge.B ${edge.B.x},${edge.B.y}`);
      ix_data.pts.push(edge.B.x, edge.B.y);
    }
  }

  return ix_data.pts;
}

/**
 * Helper to process a single intersection. Used b/c it is possible for a circle to have
 * multiple intersections.
 */
function processIntersection(circle, edge, ix_data, is_second_ix) {
  let { aInside,
          bInside,
          clockwise,
          ix } = ix_data;

  let was_tracing_segment = ix_data.is_tracing_segment;
  // determine whether we are now tracing the segment or the circle
  let is_tracing_segment = false;
  if(aInside && bInside) {
    console.warn("processIntersection2: Both endpoints are inside the circle!");
  } else if(!aInside && !bInside) {
    // two intersections
    // we must have a_outside --> i0 --> i1 --> b_outside
    is_tracing_segment = is_second_ix ? !clockwise : clockwise;
  } else {
    // either aInside or bInside are true, but not both
    is_tracing_segment = aInside ? !clockwise : clockwise;
  }

  if(!was_tracing_segment && is_tracing_segment) {
    // we have moved from circle --> segment; pad the previous intersection to here.
//     console.log("\tMoving circle --> segment.");
    if(!ix_data.circle_start) {
      console.warn("processIntersection2: undefined circle start circle --> segment");
    }
    let padding = paddingPoints(ix_data.circle_start, ix, circle, { density: ix_data.density });
//     console.log(`\tAdding ${padding.length} padding points.`, padding);

    // convert padding {x, y} to points array
    //pts = padding.flatMap(pt => [pt.x, pt.y]);
    for(const pt of padding) {
      ix_data.pts.push(pt.x, pt.y);
    }

  } else if (was_tracing_segment && !is_tracing_segment) {
    // we have moved from segment --> circle; remember the previous intersection
//     console.log("\tMoving segment --> circle");
    ix_data.circle_start = ix;
  }

  // if we were tracing the segment or are now tracing the segment, add intersection
  // Skip if:
  // - we are just continuing the circle; or
  // - the intersection is equal to the line end
  if(was_tracing_segment || is_tracing_segment &&
     !(edge.B.x.almostEqual(ix.x) &&
       edge.B.y.almostEqual(ix.y))) {
//     console.log(`\tAdding intersection ${ix.x},${ix.y}`);
    ix_data.pts.push(ix.x, ix.y);
  }

  ix_data.is_tracing_segment = is_tracing_segment;
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



