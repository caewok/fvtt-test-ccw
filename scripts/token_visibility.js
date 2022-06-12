/* globals
Token,
canvas,
game,
ClockwiseSweepPolygon
*/
"use strict";

import { SETTINGS, log } from "./module.js";
import { hasIntersectionBruteRedBlack } from "./IntersectionsBrute.js"

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
export function testVisibility(wrapped, point, {tolerance=2, object=null}={}) { // eslint-disable-line no-unused-vars
  if ( !object || !(object instanceof Token) ) return wrapped(point, {tolerance, object});
  if ( !SETTINGS.testVisibility ) return wrapped(point, {tolerance, object});

  const { lightSources, visionSources } = canvas.effects;
  if ( !visionSources.size ) return game.user.isGM;

  log(`testVisibility at ${point.x},${point.y} for ${object.name}`, object);

  const constrained = constrainedTokenShape(object);

  // If the point is entirely inside the buffer region, it may be hidden from view
  // In this case, the canvas scene rectangle must contain at least one polygon point
  // for the polygon to be in view
  // Cannot call this.#inBuffer from libWrapper
  // if ( !this.#inBuffer && !constrained.points.some(p =>
  //   canvas.dimensions.sceneRect.contains(p.x, p.y)) ) return false;

  // Test each vision source
  // TO-DO: Unclear why we would need to test FOV and LOS, as FOV is a subset of LOS, right?
  let hasLOS = false;
  let hasFOV = canvas.scene.globalLight;

  const constrained_edges = [...constrained.iterateEdges()];

  for ( const visionSource of visionSources.values() ) {
//     hasLOS ||= hasIntersectionBruteRedBlack([...visionSource.los.iterateEdges()], constrained_edges);
//     hasFOV ||= hasIntersectionBruteRedBlack([...visionSource.fov.iterateEdges()], constrained_edges);

    hasLOS ||= sourceSeesPolygon(visionSource.los, constrained);
    hasFOV ||= sourceSeesPolygon(visionSource.fov, constrained);
    if ( hasLOS && hasFOV ) return true;

  }

  // Test each light source that provides vision
  for ( const lightSource of lightSources.values() ) {
    if ( !lightSource.active || lightSource.disabled ) continue;
//     if ( (hasLOS || lightSource.data.vision) && hasIntersectionBruteRedBlack([...lightSource.los.iterateEdges()], constrained_edges) ) {
    if ( (hasLOS || lightSource.data.vision) && sourceSeesPolygon(lightSource.los, constrained) ) {
      if ( lightSource.data.vision ) hasLOS = true;
      hasFOV = true;
    }
    if ( hasLOS && hasFOV ) return true;
  }

  return false;
}

/**
 * Intersect the token bounds against line-of-sight polygon to trim the token bounds
 * to only that portion that does not overlap a wall.
 * @param {Token} token
 * @return {PIXI.Polygon}
 */
function constrainedTokenShape(token) {
  const bbox = token.bounds;
  const walls = canvas.walls.quadtree.getObjects(bbox);
  if ( !walls.size ) return bbox.toPolygon();

  const constrained = new ClockwiseSweepPolygon();
  constrained.initialize(token.center, { type: "sight", source: token.vision, boundaryShapes: [bbox] });
  constrained.compute();

  return constrained;
}

/**
 * For a given source of vision, test whether its fov or los polygon
 * contains any part of a given polygon shape
 * @param {VisionSource} source
 * @param {PIXI.Polygon} poly
 * @return {Boolean} True if contained within.
 */
function sourceSeesPolygon(source, poly) {
  // TO-DO: Would it be faster to test if any edge of the polygon intersects any edge
  // of the source? What happens if edges just overlap, as we might expect if a wall
  // separated the two?
  const intersection = source.intersectPolygon(poly);
  return intersection.points.length;
}


