/* globals
Token,
canvas,
game,
ClockwiseSweepPolygon,
foundry,
PIXI,
Ray
*/
"use strict";

import { SETTINGS, MODULE_ID, log } from "./module.js";
import * as drawing from "./drawing.js";

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

const containsTestFn = function(poly, point) { return poly.contains(point.x, point.y); }
const areaTestFn = function(poly, bounds_poly, percentArea) {
  const seen_area = sourceSeesPolygon(poly, bounds_poly);
  return seen_area > percentArea;
}

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
  if ( !object || !(object instanceof Token) || !SETTINGS.useTestVisibility ) return wrapped(point, {tolerance, object});



  let { lightSources, visionSources } = canvas.effects;
  if ( !visionSources.size ) return game.user.isGM;

  // PercentArea: Percent of the token that must be visible to count.
  // BoundsScale: Scale the bounds of the token before considering visibility.
  const { percentArea, areaTestOnly, fastTestOnly, filteredAreaTestOnly, debugAreaTestOnly } = SETTINGS;



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

  if ( fastTestOnly ) {
//     const testFn = (poly) => poly.contains(point.x, point.y);
    const res = testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, containsTestFn, point);
    hasFOV = res.hasFOV;
    hasLOS = res.hasLOS;

    if ( hasFOV && hasLOS ) {
      return true;
    } else {
      return false;
    }
  }

  if ( areaTestOnly ) {
    const constrained = constrainedTokenShape(object);
    const notConstrained = constrained instanceof PIXI.Rectangle;
    const bounds_poly = notConstrained ? constrained.toPolygon() : constrained;
    const res = testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, areaTestFn, bounds_poly, percentArea);
    hasFOV = res.hasFOV;
    hasLOS = res.hasLOS;

    return hasLOS && hasFOV;
  }

  log(`testVisibility at ${point.x},${point.y} for ${object.name}`, object);

  // Note: Converting to arrays and filtering not much of a slowdown.
  // Takes maybe 0.0001 ms and checks have to be made eventually.
  lightSources = [...lightSources]; // So we can filter, etc.
  visionSources = [...visionSources];
  visionSources = visionSources.filter(visionSource => visionSource.active);
  lightSources = lightSources.filter(lightSource => lightSource.active && !lightSource.disabled);

  if ( filteredAreaTestOnly ) {
    const constrained = constrainedTokenShape(object);
    const notConstrained = constrained instanceof PIXI.Rectangle;
    const bounds_poly = notConstrained ? constrained.toPolygon() : constrained;
    const res = testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, areaTestFn, bounds_poly, percentArea);
    hasFOV = res.hasFOV;
    hasLOS = res.hasLOS;

    return hasLOS && hasFOV;
  }

  // note: setting debug (and same for log function) not a noticeable slowdown
  const debug = game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID)
  if ( debug) {
    drawing.clearDrawings();
    drawing.drawPoint(point)
    visionSources.forEach(v => {
      drawing.drawShape(v.los, { color: drawing.COLORS.lightblue });
      drawing.drawShape(v.fov, { color: drawing.COLORS.lightgreen });
    });
    lightSources.forEach(l => {
      drawing.drawShape(l.los, { color: drawing.COLORS.lightyellow });
    });
  }

  if ( debugAreaTestOnly ) {
    const constrained = constrainedTokenShape(object);
    const notConstrained = constrained instanceof PIXI.Rectangle;
    const bounds_poly = notConstrained ? constrained.toPolygon() : constrained;
    const res = testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, areaTestFn, bounds_poly, percentArea);
    hasFOV = res.hasFOV;
    hasLOS = res.hasLOS;

    return hasLOS && hasFOV;
  }

  // Ignoring the somewhat artificial case of a token centered on a wall or corner, currently
  // ignored. Or a token that has walked through a wall at a corner.
  // Seems very difficult to construct a scenario in which the center point does not
  // control visibility as defined below.
  // TO-DO: Move constraint test here? Would be much slower.

  if ( percentArea <= .50 ) {
    // If less than 50% of the token area is required to be viewable, then
    // if the center point is viewable, the token is viewable from that source.
    const res = testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, containsTestFn, point);
    hasFOV = res.hasFOV;
    hasLOS = res.hasLOS;

    if ( hasFOV && hasLOS ) {
      log(`Returning true after testing center point with percentArea of ${percentArea}`);
      return true;
    }

  } else { // Includes the 50% case at the moment
    // If more than 50% of the token area is required to be viewable, then
    // the center point must be viewable for the token to be viewable from that source.
    // (necessary but not sufficient)
    visionSources.filter(visionSource => visionSource.fov.contains(point.x, point.y));
    lightSources = lightSources.filter(lightSource => lightSource.containsPoint(point.x, point.y));
    if ( !visionSources.length && !lightSources.length ) {
      log(`Returning false after testing center point with percentArea of ${percentArea}`);
      return false;
    }
  }
  log(`After center point test| hasLOS: ${hasLOS}; hasFOV: ${hasFOV}`);

  const constrained = constrainedTokenShape(object);
  const constrained_bbox = constrained.getBounds();
  const notConstrained = constrained instanceof PIXI.Rectangle;

  debug && drawing.drawShape(constrained_bbox, { color: drawing.COLORS.lightred, width: 5 });
  debug && drawing.drawShape(constrained, { color: drawing.COLORS.red });



  // Test the bounding box for line-of-sight for easy cases
  // Draw ray from source to the two corners that are at the edge of the viewable
  // bounding box.
  // Test if walls intersect the rays or are between the rays

  // If unconstrained token shape (rectangle):
  // no walls: has los
  // walls only on one side: has los
  // walls don't intersect rays: has los

  // If constrained token shape:
  // no walls: has los
  // otherwise, not clear whether has los

  if ( percentArea === 0) {
    const srcs = [...visionSources, ...lightSources];
    for ( const src of srcs ) {
      const keyPoints = bboxKeyCornersForOrigin(constrained_bbox, src);
      if ( !keyPoints ) { continue; }

      const rA = new Ray(src, keyPoints[0]);
      debug && drawing.drawSegment(rA, { color: drawing.COLORS.lightblue });

      const hasA = ClockwiseSweepPolygon.getRayCollisions(rA, { type: "sight", mode: "any"} );
      hasA && debug && drawing.drawSegment(rA, { color: drawing.COLORS.blue });


      if ( notConstrained && !hasA ) {
        // Walls on, at most, one side only
        hasLOS = true;
        break;
      }

      const rB = new Ray(src, keyPoints[1]);
      debug && drawing.drawSegment(rB, { color: drawing.COLORS.lightgreen });

      const hasB = ClockwiseSweepPolygon.getRayCollisions(rB, { type: "sight", mode: "any"} );
      hasB && debug && drawing.drawSegment(rB, { color: drawing.COLORS.green });
      if ( notConstrained && (!hasB || !hasA) ) {
        // Either no walls or walls on one side only
        hasLOS = true;
        break;
      }

      if ( !notConstrained && !hasB && !hasA) {
        // No walls intersect
        hasLOS = true;
        break;
      }

      if ( hasFOV && hasLOS ) {
        log(`Returning true after testing source ${src.object?.name || src.object.id}`)
        return true;
      }
    }
    log(`After key points| hasLOS: ${hasLOS}; hasFOV: ${hasFOV}`);
  }

  // A wall that completely blocks the visibility polygon means that source cannot provide
  // los.
  if ( !hasLOS ) {
    visionSources.filter(v => !wallBlocksVisibilityPolygon(constrained_bbox, v));
    lightSources.filter(l => !wallBlocksVisibilityPolygon(constrained_bbox, l));

    if ( !visionSources.length && !lightSources.length ) {
      log("Returning false after filtering for walls that completely block visibility polygon.")
      return false;
    }
  }


  // If the point is entirely inside the buffer region, it may be hidden from view
  // In this case, the canvas scene rectangle must contain at least one polygon point
  // for the polygon to be in view
  // Cannot call this.#inBuffer from libWrapper
  // if ( !this.#inBuffer && !constrained.points.some(p =>
  //   canvas.dimensions.sceneRect.contains(p.x, p.y)) ) return false;

  // From this point, we are left testing remaining sources by checking whether the
  // polygon intersects the constrained bounding box.

  let testFn;
  if ( percentArea !== 0 ) {
    log("Testing percent area");
    const bounds_poly = notConstrained ? constrained.toPolygon() : constrained;
    testFn = (poly, source) => {
      const seen_area = sourceSeesPolygon(poly, bounds_poly);
      log(`Seen area of ${seen_area} from ${source.object?.name || source.object.id}`);
      return seen_area > percentArea;
    }

  } else if ( notConstrained ) {
    log("Testing unconstrained boundary")
    testFn = (poly) => sourceIntersectsBounds(poly, constrained_bbox);

  } else {
    log("Testing constrained boundary");
    const constrained_edges = [...constrained.iterateEdges()];
    testFn = (poly) => sourceIntersectsPolygonBounds(poly, constrained_bbox, constrained_edges);
  }

  const res = testLOSFOV(visionSources, lightSources, hasLOS, hasFOV, testFn);
  hasFOV = res.hasFOV;
  hasLOS = res.hasLOS;

  log(`After final test| hasLOS: ${hasLOS}; hasFOV: ${hasFOV}`);

  return hasLOS && hasFOV;
}

/* Benchmark quadtree
PIXI.Rectangle.prototype.overlaps = function(other) {
    return (other.right >= this.left)
      && (other.left <= this.right)
      && (other.bottom >= this.top)
      && (other.top <= this.bottom);
  }

QBenchmarkLoopFn = api.bench.QBenchmarkLoopFn
QBenchmarkLoop = api.bench.QBenchmarkLoop


[src] = canvas.effects.visionSources
constrained = constrainedTokenShape(object);
constrained_bbox = constrained.getBounds();
keyPoints = bboxKeyCornersForOrigin(constrained_bbox, src);
rA = new Ray(src, keyPoints[0]);
rB = new Ray(src, keyPoints[1]);
ClockwiseSweepPolygon.getRayCollisions(rA, { type: "sight", mode: "any"} );
ClockwiseSweepPolygon.getRayCollisions(rB, { type: "sight", mode: "any"} );
visibility_poly = new PIXI.Polygon(src.x, src.y, rA.B.x, rA.B.y, rB.B.x, rB.B.y, src.x, src.y)

Array.from(canvas.walls.quadtree.getObjects(constrained_bbox).values());
Array.from(canvas.walls.quadtree.getObjects(rA.bounds).values());
Array.from(canvas.walls.quadtree.getObjects(rB.bounds).values());
Array.from(canvas.walls.quadtree.getObjects(visibility_poly.getBounds()).values());

quadFn = function(bbox) { return Array.from(canvas.walls.quadtree.getObjects(bbox).values()); }

n = 1000
await QBenchmarkLoopFn(n, constrainedTokenShape, "Constrained", object);
await QBenchmarkLoopFn(n, bboxKeyCornersForOrigin, "Key Points", constrained_bbox, src);
await QBenchmarkLoop(n, ClockwiseSweepPolygon, "getRayCollisions", rA, { type: "sight", mode: "any"});
await QBenchmarkLoop(n, ClockwiseSweepPolygon, "getRayCollisions", rB, { type: "sight", mode: "any"});

await QBenchmarkLoopFn(n, quadFn, "Quad Constrained", constrained_bbox);
await QBenchmarkLoopFn(n, quadFn, "Quad rA", rA.bounds);
await QBenchmarkLoopFn(n, quadFn, "Quad rB", rB.bounds);
await QBenchmarkLoopFn(n, quadFn, "Quad Poly", visibility_poly.getBounds());

*/

function testLOSFOVFast(visionSources, lightSources, hasLOS, hasFOV, testFn, ...args) {
  for ( const visionSource of visionSources ) {
    if ( !hasFOV && testFn(visionSource.fov, ...args) ) {
      hasFOV = true;
      hasLOS = true;
    }
    hasLOS ||= testFn(visionSource.los, ...args);
    if ( hasLOS && hasFOV ) return { hasLOS, hasFOV };
  }

  for ( const lightSource of lightSources ) {
    if ( (hasLOS || lightSource.data.vision) && testFn(lightSource.los, ...args) ) {
      return { hasLOS: true, hasFOV: true };
    }
  }

  return { hasLOS, hasFOV };
}

function testLOSFOV(visionSources, lightSources, hasLOS, hasFOV, testFn) {
  for ( const visionSource of visionSources ) {
    if ( !hasFOV && testFn(visionSource.fov, visionSource) ) {
      hasFOV = true;
      hasLOS = true;
    }
    hasLOS ||= testFn(visionSource.los, visionSource);
    if ( hasLOS && hasFOV ) return { hasLOS, hasFOV };
  }

  for ( const lightSource of lightSources ) {
    if ( (hasLOS || lightSource.data.vision) && testFn(lightSource.los, lightSource) ) {
      return { hasLOS: true, hasFOV: true };
    }
  }

  return { hasLOS, hasFOV };
}

/**
 * For a given source, construct the rays for the visibility polygon.
 * source --> bbox corner and source --> other bbox corner.
 * Test if a wall intersects both, thus blocking the source LOS from bbox entirely.
 * @param {PIXI.Rectangle} bbox
 * @param {PointSource} source
 * @return {Boolean|undefined}
 */
function wallBlocksVisibilityPolygon(bbox, source) {

  const keyPoints = bboxKeyCornersForOrigin(bbox, source);
  if ( !keyPoints ) { return undefined; }

  log(`wallBlocksVisibilityPolygon`, bbox, keyPoints);
  const debug = game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);

  const rA = new Ray(source, keyPoints[0]);
  const rB = new Ray(source, keyPoints[1]);

  debug && drawing.drawSegment(rA, {color: drawing.COLORS.lightblue} );
  debug && drawing.drawSegment(rB, {color: drawing.COLORS.lightgreen} );

  const collisionsA = ClockwiseSweepPolygon.getRayCollisions(rA, { type: "sight", mode: "all" });
  const collisionsB = ClockwiseSweepPolygon.getRayCollisions(rB, { type: "sight", mode: "all" });

  if ( !collisionsA.length || !collisionsB.length ) { return false; }

  log(`${collisionsA.length} wallsA found; ${collisionsB.length} found.`, collisionsA, collisionsB);
  const wallsA = [];
  const wallsB = [];

  collisionsA.forEach(c => wallsA.push(...c.edges));
  collisionsB.forEach(c => wallsB.push(...c.edges));

  log(`${wallsA.length} wallsA found; ${wallsB.length} found.`, wallsA, wallsB);

  if ( debug ) {
    wallsA.forEach(w => drawing.drawSegment(w, { color: drawing.COLORS.red, width: 5 }));
    wallsB.forEach(w => drawing.drawSegment(w, { color: drawing.COLORS.orange, width: 5}));
  }



  for ( const w of wallsB ) {
    if ( wallsA.includes(w) ) { return true; }
  }
  return false;
}

/**
 * Returns the two corners of the bounding box that are on the edge of the viewable
 * perimeter of the bounding box, as seen from the origin.
 * @param {PIXI.Rectangle} bbox
 * @param {Point} origin
 * @return {Point[]|null} Returns null if origin is inside the bounding box.
 */
function bboxKeyCornersForOrigin(bbox, origin) {
  const z = bbox._zone(origin);

  switch ( z ) {
    case rectZones.INSIDE: return null;
    case rectZones.TOPLEFT: return [{ x: bbox.left, y: bbox.bottom }, { x: bbox.right, y: bbox.top }];
    case rectZones.TOPRIGHT: return [{ x: bbox.left, y: bbox.top }, { x: bbox.right, y: bbox.bottom }];
    case rectZones.BOTTOMLEFT: return [{ x: bbox.right, y: bbox.bottom }, { x: bbox.left, y: bbox.top }];
    case rectZones.BOTTOMRIGHT: return [{ x: bbox.right, y: bbox.top }, { x: bbox.left, y: bbox.bottom }];

    case rectZones.RIGHT: return [{ x: bbox.right, y: bbox.top }, { x: bbox.right, y: bbox.bottom }];
    case rectZones.LEFT: return [{ x: bbox.left, y: bbox.bottom }, { x: bbox.left, y: bbox.top }];
    case rectZones.TOP: return [{ x: bbox.left, y: bbox.top }, { x: bbox.right, y: bbox.top }];
    case rectZones.BOTTOM: return [{ x: bbox.right, y: bbox.bottom }, { x: bbox.left, y: bbox.bottom }];
  }

  return undefined; // Should not happen
}


/**
 * Test if an object is visible from a given token.
 * Useful for checking visibility for cover under various limits.
 * Separately checks for line-of-sight and field-of-view.
 * @param {PointSource} source
 * @param {Token}       token
 * Options:
 * @param {Boolean}     hasFOV        Assume that the token has unlimited field of vision?
 * @param {Number}      percent_area  Percent of the token that must be visible to count.
 * @param {Number}      bounds_scale  Scale the bounds of the token before considering visibility.
 * @return { los: {Boolean}, fov: {Boolean} }
 */
function objectVisibleFromToken(token, object, {
  hasFOV = canvas.scene.globalLight,
  percent_area = 0,
  bounds_scale = 1 } = {}) {

  percent_area = Math.clamped(percent_area, 0, 1);
}


function sourceIntersectsBounds(source, bbox) {
  for ( const si of source.iterateEdges() ) {
    if ( altLineSegmentIntersectsRect(bbox, si.A, si.B) ) return true;
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

let rectZones = {
  INSIDE: 0x0000,
  LEFT: 0x0001,
  RIGHT: 0x0010,
  TOP: 0x1000,
  BOTTOM: 0x0100,
  TOPLEFT: 0x1001,
  TOPRIGHT: 0x1010,
  BOTTOMRIGHT: 0x0110,
  BOTTOMLEFT: 0x0101
};


function altLineSegmentIntersectsRect(rect, a, b, {inside = false} = {}) {
  const zone_a = rect._zone(a);
  const zone_b = rect._zone(b);

  if ( !(zone_a | zone_b) ) { return inside; } // Bitwise OR is 0: both points inside rectangle.
  if ( zone_a & zone_b ) { return false; } // Bitwise AND is not 0: both points share outside zone
  // LEFT, RIGHT, TOP, BOTTOM

  if ( !zone_a || !zone_b ) { return true; } // Regular OR: One point inside, one outside

  // Line likely intersects, but some possibility that the line starts at, say,
  // center left and moves to center top which means it may or may not cross the
  // rectangle
  switch ( zone_a ) {
    case rectZones.LEFT: return bboxAltIntersectsLeft(rect, a, b);
    case rectZones.RIGHT: return bboxAltIntersectsRight(rect, a, b);
    case rectZones.BOTTOM: return bboxAltIntersectsBottom(rect, a, b);
    case rectZones.TOP: return bboxAltIntersectsTop(rect, a, b);

    case rectZones.TOPLEFT: return bboxAltIntersectsTop(rect, a, b) || bboxAltIntersectsLeft(rect, a, b);
    case rectZones.TOPRIGHT: return bboxAltIntersectsTop(rect, a, b) || bboxAltIntersectsRight(rect, a, b);
    case rectZones.BOTTOMLEFT: return bboxAltIntersectsBottom(rect, a, b) || bboxAltIntersectsLeft(rect, a, b);
    case rectZones.BOTTOMRIGHT: return bboxAltIntersectsBottom(rect, a, b) || bboxAltIntersectsRight(rect, a, b);
  }
}

function bboxAltIntersectsTop(bbox, a, b) {
  return altLineSegmentIntersects(a, b,
    { x: bbox.x, y: bbox.y },
    { x: bbox.right, y: bbox.y });
}

function bboxAltIntersectsBottom(bbox, a, b) {
  return altLineSegmentIntersects(a, b,
    { x: bbox.right, y: bbox.bottom },
    { x: bbox.x, y: bbox.bottom });
}

function bboxAltIntersectsRight(bbox, a, b) {
  return altLineSegmentIntersects(a, b,
    { x: bbox.right, y: bbox.y },
    { x: bbox.right, y: bbox.bottom });
}

function bboxAltIntersectsLeft(bbox, a, b) {
  return altLineSegmentIntersects(a, b,
    { x: bbox.x, y: bbox.bottom },
    { x: bbox.x, y: bbox.y });
}

/**
 * Intersect the token bounds against line-of-sight polygon to trim the token bounds
 * to only that portion that does not overlap a wall.
 * @param {Token} token
 * @return {PIXI.Polygon}
 */
function constrainedTokenShape(token) {
  let bbox = token.bounds;
  if ( SETTINGS.boundsScale !== 1) {
    // BoundsScale is a percentage where less than one means make the bounds smaller,
    // greater than one means make the bounds larger.
    const scalar = SETTINGS.boundsScale - 1;
    bbox.pad(Math.ceil(bbox.width * scalar), Math.ceil(bbox.height * scalar)); // Prefer integer values; round up to avoid zeroes.
  }

  let walls = Array.from(canvas.walls.quadtree.getObjects(bbox).values());
  if ( !walls.length ) return bbox;

  // Only care about walls that strictly intersect the bbox or are inside the bbox.
  // Many times with a grid, a wall will overlap a bbox edge.
  walls = walls.filter(w => altLineSegmentIntersectsRect(bbox, w.A, w.B, { inside: true }));
  if ( !walls.length ) return bbox;

  // One or more walls are inside or intersect the bounding box.
  const constrained = new ClockwiseSweepPolygon();
  constrained.initialize(token.center, { type: "sight", source: token.vision, boundaryShapes: [bbox] });
  constrained.compute();

  // Check if we are basically still dealing with an unconstrained token shape, b/c
  // that is faster than dealing with an arbitrary polygon.
  if ( constrained.points.length !== 10 ) return constrained;

  for ( const pt of constrained.iteratePoints({ close: false }) ) {
    if ( !(pt.x.almostEqual(bbox.left) || pt.x.almostEqual(bbox.right)) ) { return constrained; }
    if ( !(pt.x.almostEqual(bbox.top) || pt.y.almostEqual(bbox.bottom)) ) { return constrained; }
  }

  return bbox;
}

/**
 * For a given source of vision, test whether its fov or los polygon
 * contains any part of a given polygon shape
 * @param {VisionSource} source
 * @param {PIXI.Polygon} poly
 * @return {Number} 0 if not seen; percent of the polygon seen otherwise
 */
function sourceSeesPolygon(source, poly) {
  log(`sourceSeesPolygon|source: ${source.points.length} points; poly: ${poly.points.length}`, source, poly);

  const intersect = source.intersectPolygon(poly);

  if ( !intersect.points.length ) { return 0; }

  return intersect.area() / poly.area();
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
// function equivalentPixel(p1, p2) {
//   // To try to improve speed, don't just call almostEqual.
//   // Ultimately need the distance between the two points but first check the easy case
//   // if points exactly vertical or horizontal, the x/y would need to be within √2 / 2
//   const dx = Math.abs(p2.x - p1.x);
//   if ( dx > Math.SQRT1_2 ) return false; // Math.SQRT1_2 === √2 / 2
//
//   const dy = Math.abs(p2.y - p1.y);
//   if ( dy > Math.SQRT1_2 ) return false;
//
//   // Within the √2 / 2 bounding box
//   // Compare distance squared.
//   const dist2 = Math.pow(dx, 2) + Math.pow(dy, 2);
//   return dist2 < 0.5;
// }

/**
 * Dot product of two segments.
 * @param {Point} r1
 * @param {Point} r2
 * @return {Number}
 */
// function dot(r1, r2) { return (r1.dx * r2.dx) + (r1.dy * r2.dy); }


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


