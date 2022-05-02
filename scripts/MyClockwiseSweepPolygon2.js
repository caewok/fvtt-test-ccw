/* globals

CONST,
foundry,
canvas,
ClockwiseSweepPolygon,
Ray,
NormalizedRectangle,
CollisionResult,
PIXI,
CONFIG,
ClipperLib,
PolygonVertex

*/

'use strict';

//import { log } from "./module.js";

import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { identifyIntersectionsWithNoEndpoint } from "./utilities.js";
import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle, findIntersectionsMyersRedBlack } from "./IntersectionsSweepMyers.js";
import { LimitedAngleSweepPolygon } from "./LimitedAngle.js";

/* Testing


CONFIG.debug.polygons = true
CONFIG.Canvas.losBackend = game.modules.get('testccw').api.MyClockwiseSweepPolygon

MyClockwiseSweepPolygon = game.modules.get('testccw').api.MyClockwiseSweepPolygon;

api = game.modules.get('testccw').api;
api.

// token
t = canvas.tokens.controlled[0];
origin = t.center;
config = {angle: t.data.sightAngle, rotation: t.data.rotation, type: "sight"};

// token limited radius
t = canvas.tokens.controlled[0];
origin = t.center;
radius = t.data.dimSight * canvas.dimensions.size / canvas.dimensions.distance;
config = {angle: t.data.sightAngle, rotation: t.data.rotation, radius: radius, density: 12, type: "sight"};

// light
l = [...canvas.lighting.sources][0];
origin = {x: l.x, y: l.y};
config = {angle: l.data.angle, density: 60, radius: l.radius, rotation: l.rotation, type: "light"};


// run full computation
poly = new MyClockwiseSweepPolygon();
poly.initialize(origin, config);
poly.compute();

// or
poly = new MyClockwiseSweepPolygon();
poly.initialize(origin, config);
poly._identifyEdges();
poly._identifyVertices();
poly._executeSweep();
poly._constructPolygonPoints();
poly._intersectBoundary();

poly = new MyClockwiseSweepPolygon();
poly.initialize(origin, config);
poly.compute();

// bench
await api.benchSweep(100, origin, config);
api.quantileBenchSweep(100, origin, config)


*/





/*
Basic concept:
1. Custom shapes for light/sight/sound can be represented using temporary walls added
   to the sweep.
2. Limited angle is one application, where two temporary walls can be added.
3. Custom boundary polygons can be defined and also added as temporary walls.
4. Limited radius circle can be determined after the sweep, by intersecting the sweep
   polygon with a circle.
5. To speed up the sweep, a bounding box for boundary polygon/limited angle/limited radius
   can be used to select walls.

Changes to ClockwiseSweep:
- Walls are trimmed only by an encompassing bbox.
- All limited radius or limited angle calculations are removed.
- A bbox is always constructed to trim vertices prior to sweep.
  - unlimited vision: bbox is the edge of the canvas
  - limited angle: bbox is the rectangle that encompasses the limited angle
  - limited radius: bbox is the rectangle bounds of the vision circle
  - angle + radius: intersect bboxes
  - custom poly boundary: bbox around poly; intersect with other bboxes as necessary

Changes to PolygonEdge:
- Need to handle edges that are not associated with a wall
- Need to be able to quickly identify intersections for a given edge
  (Use the left/right endpoint sort algorithm comparable to walls intersection)


getBoundaryEdges: Return edges for a boundary, with intersections processed
edgeOutsideBoundary: True if the edge does not cross and is not contained by the boundary
vertexOutsideBoundary: True if the vertex does not cross and is not contained by the boundary

Changes from MyCW1:
- Intersect the limitedAngle polygon instead of adding temp walls
- use limitedAngle.edgeIsOutside to drop edges not needed for the sweep

*/


export class MyClockwiseSweepPolygon2 extends ClockwiseSweepPolygon {
  constructor(...args) {
    super(...args);

    /**
     * A mapping of PolygonEdges which define potential boundaries of the polygon.
     * Keyed by edge.id, which may be equivalent to wall.id.
     * PolygonEdge represents both existing walls and temporary edges added in this
     * sweep class. To be able to link existing wall intersections with these edges,
     * this.edges must be a Map, not a Set.
     * @type {EdgeMap}
     */
    this.edges = new Map(); // ** NEW ** //
  }



  /* -------------------------------------------- */

  /**
   * @override
   * @param {Point} origin                        The provided polygon origin
   * @param {ClockwiseSweepPolygonConfig} config  The provided configuration object
   */
  initialize(origin, config) {
    super.initialize(origin, {...config}); // for benchmark & debugging, it can be problematic if the original config object is modified
    const cfg = this.config;

    // testing method of intersection
    cfg.findIntersectionsSingle ||= findIntersectionsSortSingle;
    cfg.findIntersectionsRedBlack ||= findIntersectionsBruteRedBlack;

    // *** NEW ***: Round origin b/c:
    // Origin can be non-integer in certain situations (like when dragging lights)
    // - we want a consistent angle when calculating the limited angle polygon
    // - we want a consistent straight ray from origin to the bounding box edges.
    // (Could be handled by drawing rays to floating point vertices, but this is the
    //  simpler option.)
    // TO-DO: Rounding origin implies that ClockwiseSweep should only be called when the
    // origin has moved 1+ pixels in either x or y direction.
    this.origin = { x: Math.round(this.origin.x), y: Math.round(this.origin.y) };


    // Reset certain configuration values from what ClockwiseSweep did.

    // Configure limited radius same as ClockwiseSweep.
    // Limited radius configuration used to create the circle that will
    // be intersected against the resulting sweep polygon.
    // Limited radius configuration also used to construct the bounding box
    // to trim edges/vertices.

    // Need to use maximum rays throughout to ensure we always hit the bounding box.
    cfg.radiusMax = canvas.dimensions.maxR;
    cfg.radiusMax2 = Math.pow(cfg.radiusMax, 2);


    // configure starting ray
    // (always due west; limited angle now handled by _limitedAnglePolygon)
    // ensure rounded endpoints; origin already rounded above
    cfg.rStart = new Ray(origin, { x: this.origin.x - Math.round(cfg.radiusMax), y: this.origin.y });

    // Configure artificial boundary
    // Can be:
    // - canvas edge
    // - bbox for the limited angle
    // - bbox for the limited radius circle
    // - bbox for user-provided alternative Polygon to radius circle

    // Ensure any user-provided boundaryPolygon is valid
    // - must contain the origin
    // - must be closed
    if (!this.boundaryPolygonIsValid) {
      console.warn("ClockwiseSweep: boundaryPolygon not valid.", cfg.boundaryPolygon);
      cfg.boundaryPolygon = undefined;
    }

    // boundaryPolygon is user-provided. It overrides use of the circle radius.
    // Otherwise, if a boundary is required (beyond canvas edges)
    // the limited radius and/or limited circle provide it.
    // boundaryPolygon can be combined with limitedRadius.

    // Conceptually, it might make sense to require the boundaryPolygon to be
    // centered at 0,0 and scalable, such that radius 1 gives the boundaryPolygon
    // as-is, and this configuration would then scale and shift it according to
    // provided origin and radius.

    // Store flag to indicate if the boundary is anything other than canvas walls.
    cfg.hasCustomBoundary = Boolean(cfg.boundaryPolygon) ||
                          //  cfg.hasLimitedAngle ||  // limitedAngle does not use walls, so cannot ignore vertices based on its borders.
                            cfg.hasLimitedRadius;

    // Object representing the limited angle:
    // 1 pixel behind the actual origin along rMin to the canvas border, then
    // along the canvas border to rMax, then back to 1 pixel behind the actual origin.
    if (cfg.hasLimitedAngle) {
      cfg.limitedAngle = LimitedAngleSweepPolygon.build(this.origin, cfg.angle, cfg.rotation, { contain_origin: true });

      // needed for visualization only: reset aMin, aMax, rMin, rMax
      // based on slightly moving the origin in limitedAngle
      // (otherwise unused in the sweep)
      cfg.aMin = cfg.limitedAngle.aMin;
      cfg.aMax = cfg.limitedAngle.aMax;
      cfg.rMin = cfg.limitedAngle.rMin;
      cfg.rMax = cfg.limitedAngle.rMax;
    }

    // Limited Radius boundary represented by PIXI.Circle b/c it is much faster to
    // intersect a circle with a polygon than two equivalent polygons.
    if (cfg.hasLimitedRadius && !cfg.boundaryPolygon) {
       cfg.limitedRadiusCircle = new PIXI.Circle(this.origin.x,
                                                 this.origin.y,
                                                 cfg.radius);
    }

    // Build a bounding box (PIXI.Rectangle)
    // Edge and vertex removal done by testing against bounding box.
    // (Limited angle treated as special case; vertices also rejected if not within the
    //  limited angle, for speed.)
    cfg.bbox = this._constructBoundingBox();

    // Add edges for boundaryPolygon or limitedAnglePolygon
    // User can also provide data to add temporary edges to the sweep algorithm, by
    // passing an array of SimplePolygonEdge in config.tempEdges.
    cfg.tempEdges = this._constructTemporaryEdges();
  }

  /** @inheritdoc */
  _compute() {
    // Step 1 - Identify candidate edges
    this._identifyEdges();


    // Step 2 - Construct vertex mapping
    this._identifyVertices();

    // Step 3 - Radial sweep over endpoints
    this._executeSweep();

    // Step 4 - Build polygon points
    this._constructPolygonPoints();

    // *** NEW *** //
    // Step 5 - Intersect boundary
    this._intersectBoundary();

//     console.log(`MyCW2 origin ${this.origin.x},${this.origin.y}. ${this.points.length} points; ${this._sweepPoints.length} sweep points;`);

  }

  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */

  /**
   * Changes to _identifyEdges:
   * - Use SimplePolygonEdge
   * - Test for whether the edge is within the bounding box
   * - Add boundary edges, intersecting as necessary
   * - Add custom edges, intersecting as necessary
   * - Do not otherwise restrict by angle
   * - Do not otherwise constrain by radius
   * (_getWalls will have already restricted by this.config.bbox)
   * Translate walls and other obstacles into edges which limit visibility
   * @private
   */
  _identifyEdges() {
    const { type, tempEdges, limitedAngle } = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      // ignore edges that are of a type that should be ignored
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;

      // *** NEW *** //
      if (limitedAngle && limitedAngle.edgeIsOutside(wall)) continue;
      const edge = SimplePolygonEdge.fromWall(wall, type);
      this.edges.set(edge.id, edge);
      // *** END NEW *** //
    }

    // Add edges for the canvas boundary
    // Necessary even when there is a bounding box from limitedRadius, limitedAngle,
    // or custom boundaryPolygon, because the bbox could overlap a canvas wall.
    // Also, canvas boundaries are already intersected and defined, so easier to
    // add rather than try to figure out if we need them or not.
    // (If outside the bbox, could drop them)
    for ( let boundary of canvas.walls.boundaries ) {
      const edge = SimplePolygonEdge.fromWall(boundary, type);
      this.edges.set(edge.id, edge);
    }

    // *** NEW *** //
    // Add all custom/temporary edges
    if (tempEdges.length) {
      // for all temporary edges, add after identifying intersections with existing walls.
      // temporary edges here include edges from a bounding polygon, such as limited angle

      // temporary edges checked for intersections with each other already, so jusst
      // need to compare to existing walls.
      // existing walls array is likely longer than tempEdges; thus it is second param
      // here b/c findIntersectionsDouble might be faster when the inner loop is the
      // longer one (more edges --> more chances for the inner loop to skip some)
      this.config.findIntersectionsRedBlack(tempEdges, Array.from(this.edges.values()), identifyIntersectionsWithNoEndpoint);

      // Add the temporary edges to the set of edges for the sweep.
      tempEdges.forEach(e => this.edges.set(e.id, e));

    }
    // *** END NEW *** //
  }

   /* -------------------------------------------- */

  /**
   * Changes to _getWalls:
   * - Checks for hasBoundary instead of hasLimitedRadius.
   * - Uses the configured boundary box to limit walls.
   * Get the super-set of walls which could potentially apply to this polygon.
   * @returns {Wall[]}
   * @private
   */
  _getWalls() {
    // *** NEW *** //
    if ( !this.config.hasCustomBoundary ) return canvas.walls.placeables;
    return Array.from(canvas.walls.quadtree.getObjects(this.config.bbox).values());
  }

  /* -------------------------------------------- */
  /*  Vertex Identification                       */
  /* -------------------------------------------- */

  /**
   * Changes to _identifyVertices:
   * - Remove wallEdgeMap (rely on SimplePolygonEdge to track by id instead)
   * - Replace limited angle restriction with more generic outside boundary test
   * Consolidate all vertices from identified edges and register them as part of the vertex mapping.
   * @private
   */
  _identifyVertices() {

    // Register vertices for all edges
    for ( let edge of this.edges.values() ) {

      // Get unique vertices A and B
      const ak = edge.A.key;
      if ( this.vertices.has(ak) ) edge.A = this.vertices.get(ak);
      else this.vertices.set(ak, edge.A);
      const bk = edge.B.key;
      if ( this.vertices.has(bk) ) edge.B = this.vertices.get(bk);
      else this.vertices.set(bk, edge.B);

      // Learn edge orientation with respect to the origin
      const o = foundry.utils.orient2dFast(this.origin, edge.A, edge.B);

      // Ensure B is clockwise of A
      if ( o > 0 ) {
        let a = edge.A;
        edge.A = edge.B;
        edge.B = a;
      }

      // Attach edges to each vertex
      edge.A.attachEdge(edge, -1);
      edge.B.attachEdge(edge, 1);

      // *** NEW ***: no wallEdgeMAP

    }

    // Add edge intersections
    this._identifyIntersections();

    // *** NEW ***
    if (this.config.hasCustomBoundary) {
      // Restrict vertices outside the bounding box
      // but keep the four canvas corners b/c we may need them to intersect against
      // if the custom boundary is a limited angle
//       const canvasCorners = new Set();
//       canvas.walls.boundaries.forEach(b => {
//         // boundary walls overlap at corners, so just get one corner from each
//         const [key1] = b.wallKeys;
//         canvasCorners.add(key1);
//       });

      //const bbox = this.config.bbox;
      for (let vertex of this.vertices.values()) {
        vertex.is_outside = //!canvasCorners.has(vertex.key) &&
                            this._vertexOutsideBoundary(vertex);
      }
    }
    // *** END NEW ***
  }

  /* -------------------------------------------- */

  /**
   * Changes to _identifyIntersections:
   * - No longer rely on wallEdgeMap (use SimplePolygonEdge.id instead)
   * - No limited angle checks
   * - Move registering the intersection to a separate method
   * - Check first for exiting wall intersections and second for
   *   temporary edge intersections
   * Add additional vertices for intersections between edges.
   * @param {Map<string,SimplePolygonEdge>} wallEdgeMap    A mapping of wall IDs to SimplePolygonEdge instances
   * @private
   */
  _identifyIntersections() {
    const processed = new Set();
    for ( let edge of this.edges.values() ) {

      // Check each intersecting wall
      if (edge.wall && edge.wall.intersectsWith.size) {
        for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

          // Some other walls may not be included in this polygon
          const other = this.edges.get(wall.id);
          if ( !other || processed.has(other) ) continue;

          // TO-DO: test intersection point  against bbox.contains?

          this._registerIntersection(edge, other, i);
        }
      }

      if (edge.intersectsWith.size) {
        for ( let [wall, i] of edge.intersectsWith.entries() ) {
          const other = this.edges.get(wall.id);
          if ( !other || processed.has(other) ) continue;

          // TO-DO: test intersection point  against bbox.contains?

          this._registerIntersection(edge, other, i);
        }
      }
      processed.add(edge);
    }
  }

  /* -------------------------------------------- */
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Changes to _executeSweep:
   * - radiusMax2 sets the distance of the ray
   * - isRequired property removed from CollisionResult
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { radiusMax2 } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      let result;
      if (vertex.is_outside) {
        result = { target: vertex,
                   cwEdges: vertex.cwEdges,
                   ccwEdges: vertex.ccwEdges };
      } else {
      // Construct a ray towards the target vertex
      vertex._index = i+1;

      // *** NEW ***
      const ray = Ray.towardsPointSquared(origin, vertex, radiusMax2);
      // *** END NEW ***

      this.rays.push(ray);

      // Determine whether the target vertex is behind some other active edge
      const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(ray, vertex, activeEdges);

      // Construct the CollisionResult object
        result = ray.result = new CollisionResult({
        target: vertex,
        cwEdges: vertex.cwEdges,
        ccwEdges: vertex.ccwEdges,
        isLimited: vertex.isLimited, // *** NEW ***: No isRequired
        isBehind,
        wasLimited
      });

      // Delegate to determine the result of the ray
      this._determineRayResult(ray, vertex, result, activeEdges);
      }

      // Update active edges for the next iteration
      this._updateActiveEdges(result, activeEdges);
    }
  }

  /* -------------------------------------------- */

  /**
   * Changes to _initializeActiveEdges:
   * - Use rStart (always due west) instead of rMin
   * Determine the initial set of active edges as those which intersect with the initial ray
   * @returns {EdgeSet}             A set of initially active edges
   * @private
   */
  _initializeActiveEdges() {
    const rStart = this.config.rStart; // *** NEW ***
    const edges = new Set();
    for ( let edge of this.edges.values() ) {
      // *** NEW ***: rStart
      const x = foundry.utils.lineSegmentIntersects(rStart.A, rStart.B, edge.A, edge.B);
      if ( x ) edges.add(edge);
    }
    return edges;
  }

  /* -------------------------------------------- */

  /**
   * Changes to _sortVertices:
   * - No need to sort around a reference (start is always due west)
   * Sort vertices clockwise from the initial ray (due west).
   * @returns {PolygonVertex[]}             The array of sorted vertices
   * @private
   */
  _sortVertices() {
    if ( !this.vertices.size ) return [];
    let vertices = Array.from(this.vertices.values());
    const o = this.origin;

    // *** NEW ***: No reference point

    // Sort vertices
    vertices.sort((a, b) => {

      // Sort by hemisphere
      const ya = a.y > o.y ? 1 : -1;
      const yb = b.y > o.y ? 1 : -1;
      if ( ya !== yb ) return ya;       // Sort N, S

      // Sort by quadrant
      const qa = a.x < o.x ? -1 : 1;
      const qb = b.x < o.x ? -1 : 1;
      if ( qa !== qb ) {                // Sort NW, NE, SE, SW
        if ( ya === -1 ) return qa;
        else return -qa;
      }

      // Sort clockwise within quadrant
      const orientation = foundry.utils.orient2dFast(o, a, b);
      if ( orientation !== 0 ) return orientation;

      // *** NEW ***: No reference point

      // If points are collinear, first prioritize ones which have no CCW edges over ones that do
      if ( !a.ccwEdges.size && b.ccwEdges.size ) return -1;
      if ( !b.ccwEdges.size && a.ccwEdges.size ) return 1;

      // Otherwise, sort closer points first
      if ( !a._d2 ) a._d2 = Math.pow(a.x - o.x, 2) + Math.pow(a.y - o.y, 2);
      if ( !b._d2 ) b._d2 = Math.pow(b.x - o.x, 2) + Math.pow(b.y - o.y, 2);
      return a._d2 - b._d2;
    });

    // *** NEW ***: No reference point

    return vertices;
  }

  /* -------------------------------------------- */

  /**
   * Changes in _determineRayResult:
   * - No Case 1 (Boundary rays strictly required)
   * Determine the final result of a candidate ray.
   * @param {Ray} ray                   The candidate ray being tested
   * @param {PolygonVertex} vertex      The target vertex
   * @param {CollisionResult} result    The result being prepared
   * @param {EdgeSet} activeEdges       The set of active edges
   * @private
   */
  _determineRayResult(ray, vertex, result, activeEdges) {
    // *** NEW ***: No Case 1

    // Case 2 - Some vertices can be ignored because they are behind other active edges
    if ( result.isBehind ) return;

    // Determine whether this vertex is a binding point
    const nccw = vertex.ccwEdges.size;
    const ncw = vertex.cwEdges.size;
    let isBinding = true;
    if ( result.isLimited ) {
      // Limited points can still be binding if there are two or more connected edges on the same side.
      if ( !result.wasLimited && (ncw < 2) && (nccw < 2) ) isBinding = false;
    }

    // Case 3 - If there are no counter-clockwise edges we must be beginning traversal down a new edge
    // empty -> edge
    // empty -> limited
    if ( !activeEdges.size || !nccw ) {
      return this._beginNewEdge(ray, result, activeEdges, isBinding);
    }

    // Case 4 - Limited edges in both directions
    // limited -> limited
    const ccwLimited = !result.wasLimited && (nccw === 1) && vertex.ccwEdges.first().isLimited;
    const cwLimited = !result.wasLimited && (ncw === 1) && vertex.cwEdges.first().isLimited;
    if ( cwLimited && ccwLimited ) return;

    // Case 5 - Non-limited edges in both directions
    // edge -> edge
    if ( !ccwLimited && !cwLimited && ncw && nccw ) {
      return result.collisions.push(result.target);
    }

    // Case 6 - Complete edges which do not extend in both directions
    // edge -> limited
    // edge -> empty
    // limited -> empty
    if ( !ncw || (nccw && !ccwLimited) ) {
      return this._completeCurrentEdge(ray, result, activeEdges, isBinding);
    }

    // Case 7 - Otherwise we must be jumping to a new closest edge
    // limited -> edge
    else return this._beginNewEdge(ray, result, activeEdges, isBinding);
  }

  /* -------------------------------------------- */

  /**
   * Changes to _getRayCollisions:
   * - Do not add a ray termination.
   * - Not needed because our canvas is always bound; not using limited radius rays.
   * Identify the collision points between an emitted Ray and a set of active edges.
   * @param {Ray} ray                   The candidate ray to test
   * @param {EdgeSet} activeEdges       The set of active edges
   * @param {number} [minimumDistance]  Require collisions to exceed some minimum distance
   * @returns {PolygonVertex[]}         A sorted array of collision points
   * @private
   */
  _getRayCollisions(ray, activeEdges, {minimumDistance=0}={}) {
    const collisions = [];
    const points = new Map();

    // Identify unique collision points
    for ( let edge of activeEdges ) {
      const x = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= minimumDistance) ) continue; // Require minimum distance

      // Get a unique collision point
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( points.has(c.key) ) c = points.get(c.key);
      else {
        points.set(c.key, c);
        collisions.push(c);
      }

      // Determine the orientation of the edge if the collision strikes a vertex
      let o = 0;
      if ( c.equals(edge.A) ) o = foundry.utils.orient2dFast(this.origin, edge.A, edge.B);
      else if ( c.equals(edge.B) ) o = foundry.utils.orient2dFast(this.origin, edge.B, edge.A);

      // Attach the edge to the collision point
      c.attachEdge(edge, o);
    }

    // Sort collisions on proximity to the origin
    collisions.sort((a, b) => a._distance - b._distance);

    // *** NEW ***: No additional ray termination

    return collisions;
  }

  /* -------------------------------------------- */
  /*  Polygon Construction                        */
  /* -------------------------------------------- */

  /**
   * Changes to _constructPolygonPoints:
   * - No padding for limited radius shapes (handled by intersecting circle shape after)
   * - No closing a limited shape
   * Construct the polygon from ray collision points
   * @private
   */
  _constructPolygonPoints() {
    this.points = [];

    // TO-DO: Consider not using _constructPolygonPoints at all and instead
    //        just add collision points to this.points array during the sweep.

    // Add points for rays in the sweep
    for ( let ray of this.rays ) {
      if ( !ray.result.collisions.length ) continue;

      // Add collision points for the ray
      for ( let c of ray.result.collisions ) {
        this.points.push(c.x, c.y);
      }
    }

    // ensure the polygon is closed
    this.close();
  }

  /* -------------------------------------------- */

  // Changes to visualize:
  // Handle change from Set to Map for this.edges
  /** @override */
  visualize() {
    const {radius, hasLimitedAngle, hasLimitedRadius, rMin, rMax} = this.config;

    let dg = canvas.controls.debug;
    dg.clear();

    // Text debugging
    if ( !canvas.controls.debug.debugText ) {
      canvas.controls.debug.debugText = canvas.controls.addChild(new PIXI.Container());
    }
    const text = canvas.controls.debug.debugText;
    text.removeChildren();

    // Define limitation colors
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    };

    // Draw the final polygon shape
    dg.beginFill(0x00AAFF, 0.25).drawShape(this).endFill();

    // Draw limiting radius
    if ( hasLimitedRadius ) {
      dg.lineStyle(8, 0xAACCFF, 0.5).drawCircle(this.origin.x, this.origin.y, radius);
    }

    // Draw limiting angles
    if ( hasLimitedAngle ) {
      dg.lineStyle(8, 0xAACCFF, 0.5).moveTo(rMin.A.x, rMin.A.y).lineTo(rMin.B.x, rMin.B.y);
      dg.lineStyle(8, 0xAACCFF, 0.5).moveTo(rMax.A.x, rMax.A.y).lineTo(rMax.B.x, rMax.B.y);
    }

    // Draw candidate edges
    // *** NEW ***: this.edges.values() b/c this.edges is a Map.
    for ( let edge of this.edges.values() ) {
      dg.lineStyle(4, limitColors[edge.type]).moveTo(edge.A.x, edge.A.y).lineTo(edge.B.x, edge.B.y);
    }

    // Draw vertices
    for ( let vertex of this.vertices.values() ) {
      dg.lineStyle(1, 0x000000).beginFill(limitColors[vertex.type]).drawCircle(vertex.x, vertex.y, 8).endFill();
      if ( vertex._index ) {
        let t = text.addChild(new PIXI.Text(String(vertex._index), CONFIG.canvasTextStyle));
        t.position.set(vertex.x, vertex.y);
      }
    }

    // Draw emitted rays
    for ( let ray of this.rays ) {
      const r = ray.result;
      if ( !r ) continue;
      dg.lineStyle(2, 0x00FF00, r.collisions.length ? 1.0 : 0.33).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);

      for ( let c of r.collisions ) {
        dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(c.x, c.y, 6).endFill();
      }
    }
  }


// ---------------- DEPRECATED METHODS ---------------------------------------------------

  /**
   * Restrict the set of candidate edges to those which appear within the limited angle of emission.
   * @private
   */
  _restrictEdgesByAngle() {
    console.warn(`MyClockwiseSweepPolygon does not use _restrictEdgesByAngle.`);
    super._restrictEdgesByAngle();
  }

  /**
   * Process the candidate edges to further constrain them using a circular radius of effect.
   * @private
   */
  _constrainEdgesByRadius() {
    console.warn(`MyClockwiseSweepPolygon does not use _constrainEdgesByRadius.`);
    super._constrainEdgesByRadius();
  }

  /**
   * Identify collision points for a required terminal ray.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   */
  _findRequiredCollision(ray, result, activeEdges) {
    console.warn(`MyClockwiseSweepPolygon does not use _findRequiredCollision.`);
    super._findRequiredCollision(ray, result, activeEdges);

  }

  /**
   * Add additional points to limited-radius polygons to approximate the curvature of a circle
   * @param {Ray} r0        The prior ray that collided with some vertex
   * @param {Ray} r1        The next ray that collides with some vertex
   * @private
   */
  _getPaddingPoints(r0, r1) {
    console.warn(`MyClockwiseSweepPolygon does not use _getPaddingPoints.`);
    super._getPaddingPoints(r0, r1);
  }

// ---------------- NEW METHODS ----------------------------------------------------------

  /* -------------------------------------------- */
  /*  Configuration                               */
  /* -------------------------------------------- */

 /**
  * Test whether a user-supplied boundary polygon is valid.
  * @boundaryPolygon { PIXI.Polygon|PIXI.Circle|PIXI.Rectangle }
  * @return {boolean} True if closed and contains the origin point.
  */
  boundaryPolygonIsValid(boundaryPolygon) {
    // TO-DO: Implicitly, the boundaryPolygon object must also be capable of
    // generating a bounding box and a set of edges, possibly other things.
    // Any PIXI.Polygon, PIXI.Rectangle or PIXI.Circle should work.

    // Assuming PIXI.Polygon implementation of contains
    // isClosed is from PIXIPolygon additions
    return boundaryPolygon.contains(this.origin.x, this.origin.y) &&
           boundaryPolygon.isClosed;
  }

  /**
   * Get bounding box for the boundary polygon but
   * expanded so that it definitely includes origin.
   * Does not explicitly check for this.config.hasBoundary but will return undefined if
   * no bounding box is present.
   * Will intersect limited angle and limited radius bounding boxes if both present.
   * @return {NormalizedRectangle|undefined}  Bounding box, if any
   * @private
   */
   _constructBoundingBox() {
     const { boundaryPolygon,
             hasLimitedAngle,
             hasLimitedRadius,
             limitedAngle,
             limitedRadiusCircle,
             hasCustomBoundary } = this.config;

     if (!hasCustomBoundary) return undefined;

     // start with the canvas bbox
     let bbox = canvas.dimensions.rect;

     if (boundaryPolygon) {
        bbox = bbox.intersection(boundaryPolygon.getBounds());
     } else if (hasLimitedRadius){
        bbox = bbox.intersection(limitedRadiusCircle.getBounds());
     }

     // convert to NormalizedRectangle, which is expected by _getWalls.
     // should probably be handled by the respective getBounds methods above.
     bbox = new NormalizedRectangle(bbox.x, bbox.y, bbox.width, bbox.height);

     bbox.ceil(); // force the box to integer coordinates.

     // expand to definitely include origin (otherwise, sweep algorithm could fail)
     // (probably shouldn't happen, as boundaryPolygon is previously validated)
     bbox.padToPoint(this.origin);

     // Expand out by 1 to ensure origin is contained
     // (Necessary if origin falls on a boundary edge)
     bbox.pad(1);

     return bbox;
   }

 /**
  * Add SimpleEdges from limitedAngle or boundaryPolygon
  * tempEdges array may already contain user-provided temporary edges.
  */
  _constructTemporaryEdges() {
    const { boundaryPolygon } = this.config;
    const tempEdges = this.config.tempEdges ?? [];

    if (tempEdges.length) {
      // Cannot guarantee the customEdges have intersections set up,
      // so process that set here before combining with edges that we know do not intersect.
      this.config.findIntersectionsSingle(tempEdges, identifyIntersectionsWithNoEndpoint);
    }

    if (boundaryPolygon) {
      const boundaryEdges = [];
      for (const edge in boundaryPolygon.iterateEdges()) {
        boundaryEdges.push(new SimplePolygonEdge(edge.A, edge.B));
      }
      // boundaryPolygon edges should not intersect
      // intersect against any tempEdges
      this.config.findIntersectionsRedBlack(tempEdges, boundaryEdges, identifyIntersectionsWithNoEndpoint);
      tempEdges.push(...boundaryEdges);
    }

    return tempEdges;
  }


  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */

 /**
  * Add walls identified by the user.
  * Optional, but used by Light Mask module to allow arbitrary cached walls.
  * May be useful in default Foundry for caching walls that outline, for example,
  * river borders where you want to play river sounds but not otherwise have
  * the river walled off on the canvas.
  *
  * In config.customEdges, my proposal is that the user provide an array
  * of objects that have:
  * - A and B points, as in Walls, Rays, etc.
  * - Optional type names as used in wall.data.
  * @private
  */
  _addCustomEdges() {
    const { customEdges, type } = this.config;

    if (!customEdges || customEdges.length === 0) return;

    // Need to track intersections for each edge.
    // Cannot guarantee the customEdges have intersections set up, so
    // process each in turn.
    // Thus, cannot sort edges_array in advance; must let identifyIntersections
    // re-sort at each addition.
    const edges_array = Array.from(this.edges.values());
    for ( const data of customEdges ) {
      const edge = new SimplePolygonEdge(data.A, data.B, data[type]);
      edge._identifyIntersections(edges_array);
      this.edges.set(edge.id, edge);
      edges_array.push(edge);
    }
  }


  /* -------------------------------------------- */
  /*  Vertex Identification                       */
  /* -------------------------------------------- */

 /**
  * Moved from _identifyIntersections to allow easy processing of
  * temporary edge intersections using separate loop.
  * @param {SimplePolygonEdge} edge
  * @param {SimplePolygonEdge} other
  * @param {Point} intersection     Intersection point between edge and other.
  * @private
  */
  _registerIntersection(edge, other, intersection) {
    // Register the intersection point as a vertex
    let v = PolygonVertex.fromPoint(intersection);
    if ( this.vertices.has(v.key) ) v = this.vertices.get(v.key);
    else {
      // Ensure the intersection is still inside our limited angle

      this.vertices.set(v.key, v);
    }

    // Attach edges to the intersection vertex
    if ( !v.edges.has(edge) ) v.attachEdge(edge, 0);
    if ( !v.edges.has(other) ) v.attachEdge(other, 0);
  }

 /**
  * Test if vertex is outside the boundary
  */
  _vertexOutsideBoundary(v) {
    const { bbox, limitedAngle } = this.config;

    if (limitedAngle) {
      // could just use the bbox but better to eliminate as many as possible.
      // so check against the limited angle as well
      return !(bbox.containsPoint(v) || limitedAngle.containsPoint(v));
    }

    return !bbox.containsPoint(v);
  }

  /* -------------------------------------------- */
  /* Compute Step 5: Intersect Boundary           */
  /* -------------------------------------------- */

 /**
  * Given the computed sweep points, intersect the sweep polygon
  * against a boundary, if any.
  * Two possibilities:
  * 1. Intersect the limited radius circle; or
  * 2. Intersect a provided polygon boundary
  * (limited angle handled in the sweep using temp walls)
  */
  _intersectBoundary() {
    const { boundaryPolygon, limitedRadiusCircle, limitedAngle } = this.config;
    const pts = this.points;

    // store a copy for debugging
    this._sweepPoints = [...pts];

    // Jump early if nothing to intersect
    // need three points (6 coords) to form a polygon to intersect
    if (pts.length < 6) return;

    // may be relevant for intersecting that the sweep points form a closed, clockwise polygon
    // clockwise is a difficult calculation, but can set the underlying property b/c
    // we know the sweep here forms a clockwise polygon.
    this._isClockwise = true;

    let poly = this;

    limitedAngle && (poly = limitedAngle.intersectPolygon(poly));

    if (boundaryPolygon) {
      poly = poly.clipperClip(boundaryPolygon, { cliptype: ClipperLib.ClipType.ctIntersection });

    } else if (limitedRadiusCircle) {
      poly = limitedRadiusCircle.polygonIntersect(poly, { density: this.config.density } );
    }

    // if poly is null, length less than 6, or undefined, something has gone wrong: no intersection found.
    if (!poly || poly.length < 6) {
      console.warn(`MyClockwiseSweep2|intersectBoundary failed. Origin ${this.origin.x},${this.origin.y}. ${this._sweepPoints.length} sweep points.`, poly);

      return;
    }

    this.points = poly.points;
  }

}

