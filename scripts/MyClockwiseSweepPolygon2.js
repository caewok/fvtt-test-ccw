/* globals 


*/

'use strict';

/* globals 

PolygonVertex, 
CONST,
foundry,
canvas,
PointSourcePolygon,
ClockwiseSweepPolygon,
Ray,
NormalizedRectangle,
CollisionResult,
PIXI,
CONFIG,
PolygonEdge

*/

'use strict';

//import { LinkedPolygon } from "./LinkedPolygon.js";
//import { log, MODULE_ID } from "./module.js";


/*
Basic concept: 
Create limited radius or limited angle by intersecting a shape with the basic
ClockwiseSweep computed polygon.

Changes to ClockwiseSweep:
- Walls are trimmed only by an encompassing rectangle. Radius is converted to rectangle.
- All limited radius or limited angle calculations are removed.
- After points are computed, use LinkedPolygon.intersect to trim the fov to the desired  shape.
- User can specify a boundaryPolygon in config. If not specified, one will be calculated as needed for limited radius or limited angle.
- Optional: user can specify custom edges to add to the sweep. Used to cache walls for unique shapes (e.g., river boundary or road boundary) that affect only certain light or sound objects. Could also be used to limit token vision in unique, custom ways.

Changes to PolygonEdge:
- Need to handle edges that are not associated with a wall
- Need to be able to quickly identify intersections for a given edge
  (Use the left/right endpoint sort algorithm comparable to walls intersection)
  

*/

export class MyClockwiseSweepPolygon2 extends PointSourcePolygon {

  // to make JSlint parser happy, move these inside the constructor
  constructor(...args) {
    super(...args);
    
    /**
     * The configuration of this polygon.
     * @type {ClockwiseSweepPolygonConfig}
     */
    this.config = {};

    /**
     * A mapping of vertices which define potential collision points
     * @type {VertexMap}
     */
    this.vertices = new Map();

    /**
     * The set of edges which define potential boundaries of the polygon
     * @type {EdgeSet}
     */
    this.edges = new Set();

    /**
     * A collection of rays which are fired at vertices
     * @type {Ray[]}
     */
    this.rays = [];
  }
 


  /* -------------------------------------------- */

  /**
   * @override
   * @param {Point} origin                        The provided polygon origin
   * @param {ClockwiseSweepPolygonConfig} config  The provided configuration object
   */
  initialize(origin, config) {
    super.initialize(origin, config);
    const cfg = this.config;

    // Configure limited radius
    cfg.hasLimitedRadius = cfg.radius > 0;
    cfg.radius = cfg.radius ?? canvas.dimensions.maxR;
    cfg.radius2 = Math.pow(cfg.radius, 2);
    cfg.radiusE = 0.5 / cfg.radius;

    // Configure limited angle
    cfg.aMin = -Math.PI;
    cfg.aMax = Math.PI;
    cfg.angle = cfg.angle ?? 360;
    cfg.rotation = cfg.rotation ?? 0;
    cfg.hasLimitedAngle = cfg.angle !== 360;
    cfg.density = cfg.density ?? 12;

    // Configure bounding rays
    if ( cfg.hasLimitedAngle ) {
      cfg.aMin = Math.normalizeRadians(Math.toRadians(cfg.rotation + 90 - (cfg.angle / 2)));
      cfg.aMax = cfg.aMin + Math.toRadians(cfg.angle);
      cfg.rMax = Ray.fromAngle(origin.x, origin.y, cfg.aMax, cfg.radius);
    }
    cfg.rMin = Ray.fromAngle(origin.x, origin.y, cfg.aMin, cfg.radius);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _compute() {

    
    
    // Step 1 - Identify candidate edges
    let t0 = performance.now();
    this._identifyEdges();
    let t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _identifyEdges in ${(t1 - t0).toPrecision(2)}ms`);
    }
     
    // Step 2 - Construct vertex mapping
    t0 = performance.now();
    this._identifyVertices();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _identifyVertices in ${(t1 - t0).toPrecision(2)}ms`);
    }

    // Step 3 - Radial sweep over endpoints
    t0 = performance.now();
    this._executeSweep();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _executeSweep in ${(t1 - t0).toPrecision(2)}ms`);
    }

   
    // Step 4 - Build polygon points
    t0 = performance.now();
    this._constructPolygonPoints();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _constructPolygonPoints in ${(t1 - t0).toPrecision(2)}ms`);
      
      // Run the original and compare points
      const og_poly = ClockwiseSweepPolygon.create(this.origin, this.config);
      if(!og_poly.points.equals(this.points)) {
        console.warn(`Differences detected in points of ClockwiseSweep2 vs original.`, this.points, og_poly.points);
      }
      
    }
  }

  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */

  /**
   * Translate walls and other obstacles into edges which limit visibility
   * @private
   */
  _identifyEdges() {
    const {type} = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
      const edge = MyPolygonEdge.fromWall(wall, type);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    for ( let boundary of canvas.walls.boundaries ) {
      this.edges.add(MyPolygonEdge.fromWall(boundary, type));
    }

  }

  /* -------------------------------------------- */

  /**
   * Get the super-set of walls which could potentially apply to this polygon.
   * @returns {Wall[]}
   * @private
   */
  _getWalls() {
    if ( !this.config.hasLimitedRadius ) return canvas.walls.placeables;
    const o = this.origin;
    const r = this.config.radius;
    const rect = new NormalizedRectangle(o.x - r, o.y - r, 2*r, 2*r);
    return Array.from(canvas.walls.quadtree.getObjects(rect).values());
  }


  /* -------------------------------------------- */
  /*  Vertex Identification                       */
  /* -------------------------------------------- */

  /**
   * Consolidate all vertices from identified edges and register them as part of the vertex mapping.
   * @private
   */
  _identifyVertices() {
    const wallEdgeMap = new Map();

    // Register vertices for all edges
    for ( let edge of this.edges ) {

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

      // Record the wall->edge mapping
      if ( edge.wall ) wallEdgeMap.set(edge.wall.id, edge);
    }

    // Add edge intersections
    this._identifyIntersections(wallEdgeMap);

  }

  /* -------------------------------------------- */

  /**
   * Add additional vertices for intersections between edges.
   * @param {Map<string,MyPolygonEdge>} wallEdgeMap    A mapping of wall IDs to MyPolygonEdge instances
   * @private
   */
  _identifyIntersections(wallEdgeMap) {
    const processed = new Set();
    for ( let edge of this.edges ) {

      // If the edge has no intersections, skip it
      if ( !edge.wall?.intersectsWith.size ) continue;

      // Check each intersecting wall
      for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

        // Some other walls may not be included in this polygon
        const other = wallEdgeMap.get(wall.id);
        if ( !other || processed.has(other) ) continue;

        // Verify that the intersection point is still contained within the radius


        // Register the intersection point as a vertex
        let v = PolygonVertex.fromPoint(i);
        if ( this.vertices.has(v.key) ) v = this.vertices.get(v.key);
        else {
          // Ensure the intersection is still inside our limited angle

          this.vertices.set(v.key, v);
        }

        // Attach edges to the intersection vertex
        if ( !v.edges.has(edge) ) v.attachEdge(edge, 0);
        if ( !v.edges.has(other) ) v.attachEdge(other, 0);
      }
      processed.add(edge);
    }
  }
  
  
  /* -------------------------------------------- */
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { radius2, hasLimitedAngle } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPointSquared(origin, vertex, radius2);
      this.rays.push(ray);

      // Determine whether the target vertex is behind some other active edge
      const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(ray, vertex, activeEdges);

      // Construct the CollisionResult object
      const result = ray.result = new CollisionResult({
        target: vertex,
        cwEdges: vertex.cwEdges,
        ccwEdges: vertex.ccwEdges,
        isLimited: vertex.isLimited,
        isBehind,
        wasLimited
      });

      // Delegate to determine the result of the ray
      this._determineRayResult(ray, vertex, result, activeEdges);

      // Update active edges for the next iteration
      this._updateActiveEdges(result, activeEdges);
    }
  }

  /* -------------------------------------------- */

  /**
   * Determine the initial set of active edges as those which intersect with the initial ray
   * @returns {EdgeSet}             A set of initially active edges
   * @private
   */
  _initializeActiveEdges() {
    const rMin = this.config.rMin;
    const edges = new Set();
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, edge.A, edge.B);
      if ( x ) edges.add(edge);
    }
    return edges;
  }

  /* -------------------------------------------- */

  /**
   * Sort vertices clockwise from the initial ray (due west).
   * @returns {PolygonVertex[]}             The array of sorted vertices
   * @private
   */
  _sortVertices() {
    if ( !this.vertices.size ) return [];
    let vertices = Array.from(this.vertices.values());
    const o = this.origin;

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


      // If points are collinear, first prioritize ones which have no CCW edges over ones that do
      if ( !a.ccwEdges.size && b.ccwEdges.size ) return -1;
      if ( !b.ccwEdges.size && a.ccwEdges.size ) return 1;

      // Otherwise, sort closer points first
      if ( !a._d2 ) a._d2 = Math.pow(a.x - o.x, 2) + Math.pow(a.y - o.y, 2);
      if ( !b._d2 ) b._d2 = Math.pow(b.x - o.x, 2) + Math.pow(b.y - o.y, 2);
      return a._d2 - b._d2;
    });

    return vertices;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a target vertex is behind some closer active edge
   * @param {Ray} ray                   The ray being evaluated
   * @param {PolygonVertex} vertex      The target vertex
   * @param {EdgeSet} activeEdges       The set of active edges
   * @returns {{isBehind: boolean, wasLimited: boolean}} Is the target vertex behind some closer edge?
   * @private
   */
  _isVertexBehindActiveEdges(ray, vertex, activeEdges) {
    let wasLimited = false;
    for ( let edge of activeEdges ) {
      if ( vertex.edges.has(edge) ) continue;
      const x = foundry.utils.lineSegmentIntersects(this.origin, vertex, edge.A, edge.B);
      if ( x ) {
        if ( ( edge.isLimited ) && !wasLimited ) wasLimited = true;
        else return {isBehind: true, wasLimited};
      }
    }
    return {isBehind: false, wasLimited};
  }

  /* -------------------------------------------- */

  /**
   * Determine the final result of a candidate ray.
   * @param {Ray} ray                   The candidate ray being tested
   * @param {PolygonVertex} vertex      The target vertex
   * @param {CollisionResult} result    The result being prepared
   * @param {EdgeSet} activeEdges       The set of active edges
   * @private
   */
  _determineRayResult(ray, vertex, result, activeEdges) {

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
   * Jump to a new closest active edge.
   * In this case, our target vertex will be the primary collision.
   * We may have a secondary collision if other active edges exist or if the vertex is prior to the ray endpoint.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   * @param {boolean} isBinding         Is the target vertex a binding collision point?
   * @param {boolean} secondaryBefore   Whether to add secondary collision points before ("unshift") or after ("push")
   */
  _beginNewEdge(ray, result, activeEdges, isBinding, secondaryBefore=true) {

    // We know we will strike this vertex
    if ( isBinding ) result.collisions.push(result.target);

    // Find secondary collisions against known edges
    const xs = this._getSecondaryCollisions(ray, result, activeEdges);
    if ( !xs.length ) return;
    const x0 = xs[0];

    // Toggle the insertion method
    const c = result.collisions;
    const insert = secondaryBefore ? c.unshift : c.push;

    // If there were no active walls, we hit the terminal point
    if ( !activeEdges.size ) return insert.call(c, x0);

    // Is the first collision point necessary?
    const isLimitedEdge = (x0.edges.size === 1) && x0.hasLimitedEdge; // Exactly 1 active edge
    if ( !isBinding && !isLimitedEdge ) return;
    insert.call(c, x0);

    // If we already encountered a limited edge, this was the final collision
    if ( !isLimitedEdge || result.wasLimited ) return;

    // Otherwise we have a secondary collision as long as it's not somehow equal to the target vertex
    if ( xs[1] ) insert.call(c, xs[1]);
  }

  /* -------------------------------------------- */

  /**
   * If the target vertex is connected to a currently active edge, we are terminating that edge.
   * We know the target vertex is not behind another edge, so the target is our initial collision.
   * There may be a second collision afterwards if no connected walls continue clockwise.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   * @param {boolean} isBinding         Is the target vertex a binding collision point?
   */
  _completeCurrentEdge(ray, result, activeEdges, isBinding) {
    for ( let edge of result.target.edges ) {
      activeEdges.delete(edge);
    }
    return this._beginNewEdge(ray, result, activeEdges, isBinding, false);
  }

  /* -------------------------------------------- */

  /**
   * Augment a CollisionResult with an additional secondary collision.
   * Require secondary collisions to be a greater distance than the target vertex.
   * @param {Ray} ray                   The ray being evaluated
   * @param {CollisionResult} result    The collision result
   * @param {EdgeSet} edges             The subset of active edges which are candidates for collision
   * @private
   */
  _getSecondaryCollisions(ray, result, edges) {
    const v = result.target;
    const o = this.origin;
    const t = ray.dx ? ((v.x - o.x) / ray.dx) : ((v.y - o.y) / ray.dy);
    v._distance = Math.min(t + this.config.radiusE, 1); // small epsilon
    return this._getRayCollisions(ray, edges, {minimumDistance: v._distance});
  }

  /* -------------------------------------------- */

  /**
   * Identify collision points for a required terminal ray.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   */
  _findRequiredCollision(ray, result, activeEdges) {
    const xs = this._getRayCollisions(ray, activeEdges);
    const x = xs[xs[0]?.type === CONST.WALL_SENSE_TYPES.LIMITED ? 1 : 0];
    if ( !x ) return;
    result.collisions.push(x);
  }

  /* -------------------------------------------- */

  /**
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

    // Add the ray termination
    if ( minimumDistance < 1 ) {
      const t = PolygonVertex.fromPoint(ray.B, {distance: 1});
      if ( !points.has(t.key) ) collisions.push(t);
    }
    return collisions;
  }

  /* -------------------------------------------- */

  /**
   * Update the set of active edges given the result of an emitted ray.
   * @param {CollisionResult} result        The collision result
   * @param {EdgeSet} activeEdges           The set of currently active edges
   * @private
   */
  _updateActiveEdges(result, activeEdges) {
    for ( let ccw of result.ccwEdges ) {  // Remove ccw walls which end at B
      if ( result.target.equals(ccw.B) ) activeEdges.delete(ccw);
    }
    for ( let cw of result.cwEdges ) {  // Add any cw walls
      activeEdges.add(cw);
    }
  }

  /* -------------------------------------------- */
  /*  Polygon Construction                        */
  /* -------------------------------------------- */

  /**
   * Construct the polygon from ray collision points
   * @private
   */
  _constructPolygonPoints() {
    this.points = [];

    // Add points for rays in the sweep
    for ( let ray of this.rays ) {
      if ( !ray.result.collisions.length ) continue;

      // Add collision points for the ray
      for ( let c of ray.result.collisions ) {
        this.points.push(c.x, c.y);
      }
    }
  }


  /* -------------------------------------------- */
  /*  Class Helpers                               */
  /* -------------------------------------------- */

  /**
   * Test whether a wall should be included in the computed polygon for a given origin and type
   * @param {Wall} wall         The Wall being considered
   * @param {Point} origin      The origin point for the ray or polygon
   * @param {string} type       The type of perception or movement restriction being imposed
   * @returns {boolean}         Should the wall be included?
   *
   */
  static testWallInclusion(wall, origin, type) {

    // Always include interior walls underneath active roof tiles
    if ( (type === "sight") && wall.hasActiveRoof ) return true;

    // Ignore walls that are not blocking for this polygon type
    if ( !wall.data[type] || wall.isOpen ) return false;

    // Ignore walls which are exactly in-line with the origin, except for movement
    const side = wall.orientPoint(origin);
    if ( (type !== "move") && (side === CONST.WALL_DIRECTIONS.BOTH) ) return false;

    // Ignore one-directional walls which are facing away from the origin
    return !wall.data.dir || (side !== wall.data.dir);
  }

  /* -------------------------------------------- */

  /**
   * Test whether a vertex lies between two boundary rays
   * @param {PolygonVertex} vertex    The target vertex
   * @param {Ray} rMin                The counter-clockwise bounding ray
   * @param {Ray} rMax                The clockwise bounding ray
   * @param {number} angle            The angle being tested, in degrees
   * @returns {boolean}               Is the vertex between the two rays?
   */
   static pointBetweenRays(vertex, rMin, rMax, angle) {
     const ccw = foundry.utils.orient2dFast;

     // If the angle is greater than 180, instead check for vertices between rMax and rMin (inverse)
     if ( angle > 180 ) {
       const outside = (ccw(rMax.A, rMax.B, vertex) <= 0) && (ccw(rMin.A, rMin.B, vertex) >= 0);
       return !outside;
     }

     // Otherwise keep vertices that are inside
    return (ccw(rMin.A, rMin.B, vertex) <= 0) && (ccw(rMax.A, rMax.B, vertex) >= 0);
   }

  /* -------------------------------------------- */

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
    }

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
    for ( let edge of this.edges ) {
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

  /* -------------------------------------------- */
  /*  Collision Testing                           */
  /* -------------------------------------------- */

  /**
   * Check whether a given ray intersects with walls.
   * @param {Ray} ray                   The Ray being tested
   * @param {object} [options={}]       Options which customize how collision is tested
   * @param {string} [options.type=move]        Which collision type to check, a value in CONST.WALL_RESTRICTION_TYPES
   * @param {string} [options.mode=all]         Which type of collisions are returned: any, closest, all
   * @param {boolean} [options.debug=false]     Visualize some debugging data to help understand the collision test
   * @return {boolean|object[]|object}  Whether any collision occurred if mode is "any"
   *                                    An array of collisions, if mode is "all"
   *                                    The closest collision, if mode is "closest"
   */
  static getRayCollisions(ray, {type="move", mode="all", debug=false}={}) {
    const origin = ray.A;

    // Identify Edges
    const edges = [];
    const walls = canvas.walls.quadtree.getObjects(ray.bounds);
    for ( let wall of walls ) {
      if ( !this.testWallInclusion(wall, ray.A, type) ) continue;
      const edge = PolygonEdge.fromWall(wall, type);
      const intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, origin, ray.B);
      if ( intersects ) {
        if ( mode === "any" ) {   // We may be done already
          if ( (wall.data[type] === CONST.WALL_SENSE_TYPES.NORMAL) || (edges.length > 1) ) return true;
        }
        edges.push(edge);
      }
    }
    if ( mode === "any" ) return false;

    // Identify Collision Points
    const collisions = [];
    const points = new Map();
    for ( let edge of edges ) {
      const x = foundry.utils.lineSegmentIntersection(origin, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= 0) ) continue;

      // Record the collision
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( points.has(c.key) ) c = points.get(c.key);
      else {
        points.set(c.key, c);
        collisions.push(c);
      }
      c.attachEdge(edge);
    }

    // Return all collisions
    if ( debug ) this._visualizeCollision(ray, edges, collisions);
    if ( mode === "all" ) return collisions;

    // Return the closest collision
    collisions.sort((a, b) => a._distance - b._distance);
    if ( collisions[0].type === CONST.WALL_SENSE_TYPES.LIMITED ) collisions.shift();
    return collisions[0] || null;
  }

  /* -------------------------------------------- */

  /**
   * Visualize the polygon, displaying its computed area, rays, and collision points
   * @private
   */
  static _visualizeCollision(ray, edges, collisions) {
    let dg = canvas.controls.debug;
    dg.clear();
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    }

    // Draw edges
    for ( let edge of edges ) {
      dg.lineStyle(4, limitColors[edge.type]).moveTo(edge.A.x, edge.A.y).lineTo(edge.B.x, edge.B.y);
    }

    // Draw the attempted ray
    dg.lineStyle(4, 0x0066CC).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);

    // Draw collision points
    for ( let x of collisions ) {
      dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(x.x, x.y, 6).endFill();
    }
  }
}  
  

/* MyPolygonEdge
Needs:
- fromWall method (wall, type)
- A, B
- ._nw, ._se
- intersectsWith map 
- id



/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
// function compareXY(a, b) {
//   if ( a.x === b.x ) return a.y - b.y;
//   else return a.x - b.x;
// }

class MyPolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    this.A = new PolygonVertex(a.x, a.y);
    this.B = new PolygonVertex(b.x, b.y);
    this.type = type;
    this.wall = wall;
  }

  /**
   * Is this edge limited in type?
   * @returns {boolean}
   */
  get isLimited() {
    return this.type === CONST.WALL_SENSE_TYPES.LIMITED;
  }

  /**
   * Construct a PolygonEdge instance from a Wall placeable object.
   * @param {Wall|WallDocument} wall  The Wall from which to construct an edge
   * @param {string} type             The type of polygon being constructed
   * @returns {PolygonEdge}
   */
  static fromWall(wall, type) {
    const c = wall.data.c;
    return new this({x: c[0], y: c[1]}, {x: c[2], y: c[3]}, wall.data[type], wall);
  }
}

