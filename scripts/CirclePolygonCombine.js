/* globals
PIXI,
foundry,
Ray,
ClockwiseSweepPolygon
*/

'use strict';

//import { log } from "./module.js";
import { SimplePolygon, SimplePolygonVertex } from "./SimplePolygon.js";

/*
Intersect or union a polygon with a circle without immediately converting circle to a polygon. Similar method to that of SimplePolygon._combine. Start at intersection point, tracing polygon or circle. At each intersection point, pick the clockwise (intersect) or counterclockwise (union) direction. Use padding to fill the circle to the next intersection. 
*/

export function circle_union(poly, { density = 60 } = {}) {
  // for simplicity, if poly is also a circle, just convert to a polygon
  poly = SimplePolygon.fromPolygon(poly, { density });

  // when tracing a polygon in the clockwise direction:
  // union: pick the counter-clockwise choice at intersections
  // intersect: pick the clockwise choice at intersections
  return _combine(poly, this, { clockwise: false, density });
}

 /**
  * Find the polygon representing the intersection of two polygons.
  * Polygons must be simple---they cannot intersect themselves.
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * @return {PIXI.Polygon}
  */  
export function circle_intersect(poly, { density = 60 } = {}) {
  poly = SimplePolygon.fromPolygon(poly, { density });
  const out = _combine(poly, this, { clockwise: true, density });
  
  // intersection of two convex polygons is convex
  // circle is always convex
  // don't re-run convexity but add parameter if available
  if(poly._isConvex) { out._isConvex = true; }
  
  return out;
}
  
 /**
  * Combine two polygons. Helper for union and intersect methods.
  * Polygons must be simple---they cannot intersect themselves.
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * Options: 
  * @param {boolean} clockwise  True if the trace should go clockwise at each 
  *                             intersection; false to go counterclockwise.
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

function _circleEncompassesPolygon(circle, poly) {
  const iter = poly.iteratePoints();
  for(const pt of iter) {
    if(!circle.contains(pt.x, pt.y)) return false;
  }
  return true;
}

function _tracePolygon(poly, circle, { clockwise = true, density = 60 } = {}) {
  const center = { x: circle.x, y: circle.y };
  const radius = circle.radius;
  const pts = [];
  
  // need to locate all the intersections b/c we will draw padding 
  // (polygon version of circle) between each intersection as needed.
  
  let first_edge = undefined;
  for(const edge of poly.edges) {
    // locate first intersection
    const x = foundry.utils.lineCircleIntersection(edge.A, edge.B, center, radius);
    if(x.intersections.length > 0) {
      if(!first_edge) first_edge = edge;
      edge._circleIntersection = x;
    }
  }
  
  // if no intersections, can return.
  if(!first_edge) { return pts; }
  
  
  let curr_edge = first_edge;
  let tracing_segment = true;
  let circle_start = undefined;
  
  const max_iterations = poly.points.length / 2 + 1;
  let i;
  for(i = 0; i < max_iterations; i += 1) {
    
    const circle_x = curr_edge._circleIntersection;
    if(circle_x) {
      // convert intersections to nearest pixel so we can use keys to match to vertices
      circle_x.intersections = circle_x.intersections.map(i => 
                                 SimplePolygonVertex.fromPoint(i));
    
      // at least 1 intersection
      const res0 = _processIntersection(circle_x, 0, center, { clockwise, 
                                                               tracing_segment, 
                                                               circle_start,
                                                               density});
      tracing_segment = res0.tracing_segment;
      circle_start = res0.circle_start;
      if(res0.pts.length > 0) { pts.push(...res0.pts); }
      
      // process second intersection, if any
      if(circle_x.intersections.length > 1) {
        const res1 = _processIntersection(circle_x, 1, center, { clockwise, 
                                                                 tracing_segment, 
                                                                 circle_start,
                                                                 density});
        tracing_segment = res1.tracing_segment;
        circle_start = res1.circle_start;
        if(res1.pts.length > 0) { pts.push(...res0.pts); }
      }
    } // done with intersection processing
    
    if(curr_edge === first_edge && i > 0) break;
    
    
    if(tracing_segment) {
      // add the edge B vertex to points array unless we already did 
      // (if it was an intersection, would have been added above)
      if(circle_x && circle_x.intersections.every(i => i.key !== curr_edge.B.key)) {
        pts.push(curr_edge.B.x, curr_edge.B.y);
      }
    }
  
    curr_edge = curr_edge.next;
    
  } // end for loop
   
  return pts;  
}

/**
 * Helper to process a single intersection. Used b/c it is possible for a circle to have 
 * multiple intersections. 
 * @param {LineCircleIntersection} circle_x
 * @param {number} i  Which intersection to process
 * @param {Point} center  Center of the circle
 * Options:
 * @param {boolean} clockwise   True if the clockwise/intersect direction should be used.
 * @param {boolean} tracing_segment Are we currently on the segment?
 * @param {Point} circle_start  Prior intersection used to connect circle
 * @param {number} density      How much padding (polygon points) to use?
 */
function _processIntersection(circle_x, i, center, { clockwise = true, 
                                            tracing_segment = true, 
                                            circle_start = undefined,
                                            density = 60 } = {}) {
  const x = circle_x.intersections[i];
  if(!x) return;
  
  let padding = [];
  
/* Determine whether to move along polygon or along circle
(1) If segment A --> B moves inside the circle, segment is the CW/intersect choice.
(2) If segment A --> B moves outside the circle, segment is the CCW/union choice.

(3) If circle is tangent to the segment, segment is the CCW/union choice.

(4) If segment A --> B intersects the circle twice, it must start outside and end outside.
    For first intersection, circle is the CCW/union choice.
    For second intersection, segment is the CCW/union choice.

lineCircleIntersection would return no intersections if A and B both contained in the circle, so not really possible for A or B to be on the circle. But if A or B inside the circle, and only 1 intersection:
If A is on the circle (tangent), B inside: segment is the CW/intersect choice (1 above)
If A is on the circle, B outside: segment is the CCW/union choice (2 above)
If B is on the circle (tangent), it would depend on the next edge, which in theory should
have an intersection
*/
  // recall cannot have aInside and bInside with intersections
  const was_tracing_segment = tracing_segment
  if(circle_x.tangent) {
    log(`At circle tangent ${x.x}, ${x.y}.`)
    tracing_segment = !clockwise; // on circle if we want clockwise direction
  } else if(circle_x.bInside) { 
    tracing_segment = clockwise; // on circle if we want CCW direction
  } else if(circle_x.aInside) { // b outside
    tracing_segment = !clockwise;
  } else if(i) {  // a outside, b outside, second intersection
    tracing_segment = clockwise;  
  } else { // a outside, b outside, first intersection
    tracing_segment = !clockwise
  }
  
  // if we have moved from circle to segment:
  // pad from previous intersection to here
  if(!was_tracing_segment && tracing_segment) {
    padding = paddingPoints(circle_start, x, center, { density });
  }
  
  // if we have moved from segment to circle:
  // remember the previous intersection
  if(was_tracing_segment && !tracing_segment) {
    circle_start = x;
  }
  
  // convert padding {x, y} to points array
  padding = padding.flatMap(pt => [pt.x, pt.y]);
  padding.push(x.x, x.y); // add intersection point
  
  return { pts: padding,
           tracing_segment: tracing_segment,
           circle_start: circle_start };
}

function paddingPoints(fromPt, toPoint, center, { density = 60 } = {}) {
  // can use ClockwiseSweepPolygon.prototype._getPaddingPoints
  const obj = { config: { density }};
  const r0 = new Ray(center, fromPt);
  const r1 = new Ray(center, toPoint);
  
  return ClockwiseSweepPolygon.prototype._getPaddingPoints.call(obj, r0, r1);
}



