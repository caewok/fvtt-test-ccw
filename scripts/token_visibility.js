/* globals
Token,
canvas,
game,
ClockwiseSweepPolygon,
foundry
*/
"use strict";

import { SETTINGS, log } from "./module.js";

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

  // if unconstrained token shape:
  // vision source contains center point: los
  // rays are origin --> corner1 and corner2
  // LOS test: walls block, los fails, can return false
  // no walls: has los
  // walls only on one side: has los
  // walls don't intersect rays: has los
  //
  // need to test fov

  // if constrained token shape:
  // LOS test: walls block, los fails, can return false
  // no walls: has los
  // otherwise, not clear whether has los
  // need to test los and fov



  const constrained = constrainedTokenShape(object);

  // If the point is entirely inside the buffer region, it may be hidden from view
  // In this case, the canvas scene rectangle must contain at least one polygon point
  // for the polygon to be in view
  // Cannot call this.#inBuffer from libWrapper
  // if ( !this.#inBuffer && !constrained.points.some(p =>
//     canvas.dimensions.sceneRect.contains(p.x, p.y)) ) return false;

  // Test each vision source
  // https://ptb.discord.com/channels/170995199584108546/956307084931112960/985541410495283250
  // Atropos — Today at 6:49 AM
  // Yeah, there is a piece you are missing here. For a point to be visible it must be in both
  // line of sight as well as in a FOV polygon. From the perspective of only one vision source,
  // only testing FOV would be sufficient, but it gets more complex when you have other light
  // sources in the scene which provide additional FOV polygons but with different LOS.
  // Consider, for example, an object which is outside of the Token's FOV, but inside the
  // Token's LOS. If that object is inside the FOV of a light source, it will still be visible.
  let hasLOS = false;
  let hasFOV = canvas.scene.globalLight;

  const constrained_edges = [...constrained.iterateEdges()];
  const constrained_bbox = constrained.getBounds();

  for ( const visionSource of visionSources.values() ) {
    hasLOS ||= sourceIntersectsPolygonBounds(visionSource.los, constrained_bbox, constrained_edges);
    hasFOV ||= sourceIntersectsPolygonBounds(visionSource.fov, constrained_bbox, constrained_edges);

//     hasLOS ||= sourceSeesPolygon(visionSource.los, constrained);
//     hasFOV ||= sourceSeesPolygon(visionSource.fov, constrained);
    if ( hasLOS && hasFOV ) return true;

  }

  // Test each light source that provides vision
  for ( const lightSource of lightSources.values() ) {
    if ( !lightSource.active || lightSource.disabled ) continue;
    if ( (hasLOS || lightSource.data.vision) && sourceIntersectsPolygonBounds(lightSource.los, constrained_bbox, constrained_edges) ) {
//     if ( (hasLOS || lightSource.data.vision) && sourceSeesPolygon(lightSource.los, constrained) ) {
      if ( lightSource.data.vision ) hasLOS = true;
      hasFOV = true;
    }
    if ( hasLOS && hasFOV ) return true;
  }

  return false;
}


function sourceIntersectsBounds(source, bbox, source_edges) {
  for ( const si of source.iterateEdges() ) {
    if ( bbox.lineSegmentIntersects(si.A, si.B) ) return true;
  }

  return false;
}


/**
 * Stricter intersection test between polygon and a constrained token bounds.
 * 1. Overlapping edges are not considered intersecting.
 * 2. endpoints that overlap the other segment are not considered intersecting.
 * 3. bounds rectangle used to skip edges
 *
 * (1) and (2) are to avoid situations in which the boundary polygon and the source polygon
 * are separated by a wall.
 */
function sourceIntersectsPolygonBounds(source, bbox, bounds_edges) {
  const ln2 = bounds_edges.length;

  for ( const si of source.iterateEdges() ) {
    // Only if the segment intersects the bounding box or is completely inside, test each edge
    if ( !bbox.lineSegmentIntersects(si.A, si.B, { inside: true }) ) { continue; }

    for (let j = 0; j < ln2; j += 1) {
      const sj = bounds_edges[j];
      if ( altLineSegmentIntersects(si.A, si.B, sj.A, sj.B) ) { return true; }
    }
  }
  return false;
}

/**
 * Alternative lineSegmentIntersects test that rejects collinear lines as well
 * as lines that intersect at an endpoint.
 */
function altLineSegmentIntersects(a, b, c, d) {
  // First test the orientation of A and B with respect to CD to reject collinear cases
  const xa = orient2dPixelLine(a, b, c);
  const xb = orient2dPixelLine(a, b, d);
  if ( !xa || !xb ) return false;
  const xab = (xa * xb) < 0;

  // Also require an intersection of CD with respect to AB
  const xcd = (foundry.utils.orient2dFast(c, d, a) * foundry.utils.orient2dFast(c, d, b)) < 0;
  return xab && xcd;
}


/**
 * Fast version that tests rays against the bounding box corners
 * If inconclusive, resort to slower test.
 */
function testBBox(origin, bbox) {

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

/**
 * Measure whether two coordinates could be the same pixel.
 * Points within √2 / 2 distance of one another will be considered equal.
 * Consider coordinates on a square grid: √2 / 2 is the distance from any
 * corner of the square to the center. Thus, any coordinate within the square that
 * is within √2 / 2 of a corner can be "claimed" by the pixel at that corner.
 * @param {Point} p1
 * @param {Point} p2
 * @return {boolean}  True if the points are within √2 / 2 of one another.
 */
function equivalentPixel(p1, p2) {
  // To try to improve speed, don't just call almostEqual.
  // Ultimately need the distance between the two points but first check the easy case
  // if points exactly vertical or horizontal, the x/y would need to be within √2 / 2
  const dx = Math.abs(p2.x - p1.x);
  if ( dx > Math.SQRT1_2 ) return false; // Math.SQRT1_2 === √2 / 2

  const dy = Math.abs(p2.y - p1.y);
  if ( dy > Math.SQRT1_2 ) return false;

  // Within the √2 / 2 bounding box
  // Compare distance squared.
  const dist2 = Math.pow(dx, 2) + Math.pow(dy, 2);
  return dist2 < 0.5;
}

/**
 * Dot product of two segments.
 * @param {Point} r1
 * @param {Point} r2
 * @return {Number}
 */
function dot(r1, r2) { return (r1.dx * r2.dx) + (r1.dy * r2.dy); }


/**
 * Is point c counterclockwise, clockwise, or colinear w/r/t ray with endpoints A|B?
 * If the point is within ± √2 / 2 of the line, it will be considered collinear.
 * See equivalentPixel function for further discussion on the choice of √2 / 2.
 * @param {Point} a   First endpoint of the segment
 * @param {Point} b   Second endpoint of the segment
 * @param {Point} c   Point to test
 * @return {number}   Same as foundry.utils.orient2dFast
 *                    except 0 if within √2 /2 of the ray.
 *                    Positive: c counterclockwise/left of A|B
 *                    Negative: c clockwise/right of A|B
 *                    Zero: A|B|C collinear.
 */
function orient2dPixelLine(a, b, c) {
  const orientation = foundry.utils.orient2dFast(a, b, c);
  const dist2 = Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2);
  const orientation2 = Math.pow(orientation, 2);
  const cutoff = 0.5 * dist2; // 0.5 is (√2 / 2)^2.

  return (orientation2 < cutoff) ? 0 : orientation;
}


/**
 * Is the point c within a pixel of the segment and thereby "contained" by the segment?
 * @param {Point} a   First endpoint of the segment
 * @param {Point} b   Second endpoint of the segment
 * @param {Point} c
 * @return {boolean}  True if the segment contains the point c.
 */
// function pixelLineContainsPoint(a, b, c) {
//   if (equivalentPixel(a, c)
//       || equivalentPixel(b, c)) { return true; }
//
//   if (orient2dPixelLine(a, b, c) !== 0) { return false; }
//
//   // Test if point is between the endpoints, given we already established collinearity
//   const ab = dot(a, b);
//   const ac = dot(a, c);
//
//   // If ac === 0, point p coincides with A (handled by prior check)
//   // If ac === ab, point p coincides with B (handled by prior check)
//   // ac is between 0 and ab, point is on the segment
//   return ac >= 0 && ac <= ab;
// }


