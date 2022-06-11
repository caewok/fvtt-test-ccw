/* globals

*/
"use strict";

import { SETTINGS } from "./module.js";
import { findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";

/* Proposed algorithm:

The goal is to construct a polygon representing the visible area, absent walls, between
the source origin and the token shape. Then, for each intersecting wall, cut away part
of the polygon. If the origin is no longer part of the polygon, the token cannot be seen.

Step 1: Intersect Token shape with Token LOS to get constrained bounding box
If a token overlaps one or more walls, the potentially visible token area should not
include parts that are on the other side of the wall. Thus, intersect the token shape
against the token line of sight polygon. Call that the "constrained bounding box."

Step 2: Determine key constrained bounding box points.
Determine which points of the constrained bounding box represent the limits of what could
be seen from the vision source. If it were definitely a rectangle, that would be easy.
As a polygon, probably need to draw rays from each point to the origin. If the ray
intersects the polygon, it is not a key ray.

Step 3: Construct visibility polygon and rays
The polygon is the source origin --> key bounding box points.
Rays are origin --> key corner 1 and origin --> key corner 2 where 1 and 2 are found
by moving clockwise and counter-clockwise from origin around the visibility polygon.

Step 4: Get walls
Use quadtree to get walls that might intersect the polygon. Cull further by keeping only
walls that intersect one of the two rays or are contained entirely between the rays.
Return false early if a wall intersects both rays (such a wall completely cuts off the origin).
Return true early if zero or one wall found.
(A single wall intersecting only one ray cannot completely block the origin.)

Note that we need only know that a wall intersects the rays, not where the intersection is located.

Return true early if all the walls intersect the same ray.

(It might be possible to keep only interior walls or the wall that extends furthest into
the visibility polygon on each side. But "furthest" here is with respect to the origin
and is not easily determined without looking at intersection points and possibly shooting
rays from the origin to test for collisions.)

Step 5: Cut away the visibility polygon
At this point, we have 2+ walls that intersect both rays. With certain orientations,
such walls could combine to completely block vision.
(Think of a winding corridor, where a close wall from the right combines with a wall
further back from the left to block everything in sight.)

For each wall, construct a polygon from source origin --> wall.A --> wall.B ("wall polygon").

Use clipper difference to cut away the visibility polygon using the wall polygon.
If the origin is no longer part of the polygon, then we know the origin cannot see the token.
(This can be tested after each clipper operation; return false early if so).

If the origin is still present after all walls are added, return true.
*/

/**
 * Wrap CanvasVisibility.prototype.testVisibility.
 * For now, override only for testing token vs token
 *
 * Test whether a point on the Canvas is visible based on the current vision and LOS polygons.
 *
 * @param {Point} point                 The point in space to test, an object with coordinates x and y.
 * @param {object} [options]            Additional options which modify visibility testing.
 * @param {number} [options.tolerance=2]    A numeric radial offset which allows for a non-exact match. For example,
 *                                          if tolerance is 2 then the test will pass if the point is within 2px of a
 *                                          vision polygon.
 * @param {PIXI.DisplayObject} [options.object] An optional reference to the object whose visibility is being tested
 * @returns {boolean}                   Whether the point is currently visible.
 */
export function testVisibility(wrapped, point, {tolerance=2, object=null}={}) {
  if ( !object || !(object instanceof Token) ) return wrapped();
  if ( !SETTINGS.testVisibility ) return wrapped();

  const { lightSources, visionSources } = canvas.effects;
  if ( !visionSources.size ) return game.user.isGM;

  // TO-DO: Is it more efficient to first test whether lines cross the rays between
  // point and bounding box corners? Could determine relevant corners by checking the
  // location of the point in relation to the bbox rectangle.
  // See [Cohen-Sutherland](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm) zones.

  // 1. Intersect the token shape with its line-of-sight, to eliminate portions overlapping
  //    a wall.
  const bbox = object.getBounds();
  const los = object.vision.los;
  let constrained;
  if ( !los ) {
    // Token likely does not have Vision enabled
    constrained = new ClockwiseSweepPolygon();
    constrained.initialize(object.center, { type: sight, source: object.vision, boundaryShapes = [bbox] });
    constrained.compute();
  } else {
    constrained = los.intersectPolygon(bbox.toPolygon());
  }

  // If the point is entirely inside the buffer region, it may be hidden from view
  // In this case, the canvas scene rectangle must contain at least one polygon point
  // for the polygon to be in view
  if ( !this.#inBuffer && !constrained.points.some(p => canvas.dimensions.sceneRect.contains(p.x, p.y)) ) return false;

  // 2. Determine key points.
  // TO-DO: Is there an easy way to know if constrained equals the bbox? Maybe just
  // compare the points?

  // For the polygon, test ray to origin point for whether it intersects any edges.
  // Organize the points such that the first is the leftmost key point.
  const constrained_edges = [...constrained.iterateEdges()];
  const key_points = [];
  let non_key_found = false;
  for ( const pt of constrained.iteratePoints() ) {
    const ray = new Ray(pt, point);
    if ( !findIntersection(constrained_edges, ray) ) {
      if ( non_key_found ) {
        key_points.shift(pt);
      } else {
        key_points.push(pt);
      }

    } else {
      non_key_found = true;
    }
  }

  // Step 3: Construct visibility polygon and rays
  // Because key points are ordered, origin --> last key point --> other points --> first key point
  // is clockwise.
  const visibility_polygon = new PIXI.Polygon(...key_points, point);
//   visible_polygon._clockwise = false; // for testing, don't set

  const ray1 = new Ray(point, key_points[0]);
  const ray2 = new Ray(point, key_points[key_points.length - 1]);


  // Step 4: Get walls
  const visibility_bbox = visibility_polygon.getBounds();
  const walls = canvas.walls.quadtree.getObjects(bounds).values();
  if ( !walls.length ) { return true; }

  // Filter walls
  // Catch when we can return early
  let ray1_intersected = false;
  let ray2_intersected = false;
  const constrained_walls = [];
  for ( wall of walls ) {
    // keep if wall intersects either ray or is contained between the rays
    const r1_ix = foundry.utils.lineSegmentIntersects(ray1.A, ray1.B, wall.A, wall.B);
    const r2_ix = foundry.utils.lineSegmentIntersects(ray1.A, ray1.B, wall.A, wall.B);

    // If wall completely bisects the visibility polygon, we know it blocks sight from the
    // origin point.
    if ( r1_ix && r2_ix ) return false;

    ray1_intersected ||= r1_ix;
    ray2_intersected ||= r2_ix;



  }







}

function findIntersection(edges, ray) {
  const ln = edges.length;
  for (let i = 0; i < ln; i += 1) {
    const si = edges[i];
    if ( foundry.utils.lineSegmentIntersects(si.A, si.B, ray.A, ray.B )) { return true; }
  }
  return false;
}
