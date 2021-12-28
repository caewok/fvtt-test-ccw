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

import { LinkedPolygon2 } from "./LinkedPolygon2.js";
import { log } from "./module.js";


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
    this.edges = new Map();

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
    
    cfg.radiusMax = Math.pow(canvas.dimensions.maxR, 2); // for drawing rays b/c radius may not be enough to hit the bounding box

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
      cfg.rMax = Ray.fromAngle(origin.x, origin.y, cfg.aMax, cfg.radiusMax);
    }
    cfg.rMin = Ray.fromAngle(origin.x, origin.y, cfg.aMin, cfg.radiusMax);
    
    // check if we need a boundary polygon
    // Needed if: user-provided or limited angle or limited radius
    cfg.hasBoundary = Boolean(cfg.boundaryPolygon) || cfg.hasLimitedRadius || cfg.hasLimitedAngle; 
    if(cfg.hasBoundary && !cfg.boundaryPolygon) {
      cfg.boundaryPolygon = this._getBoundaryPolygon();
      cfg.bbox = this._getBoundingBox();
    } 
  }
  
 /**
  * Construct the boundary polygon.
  * Approximate a circle if limited radius. 
  * Draw angles from origin to canvas edges if limited angle. 
  * @private
  */
  _getBoundaryPolygon() {
    let boundaryPolygon;  
    if(this.config.hasLimitedRadius) {
      const circle = new PIXI.Circle(this.origin.x, this.origin.y, this.config.radius);
      boundaryPolygon = circle.toPolygon(this.config.density);
    }
    
    if(this.config.hasLimitedAngle) {
      const ltd_angle_poly = this._limitedAnglePolygon();
      // if necessary, find the intersection of the radius and limited angle polygons
      boundaryPolygon = this.config.hasLimitedRadius ? 
        LinkedPolygon2.intersect(boundaryPolygon, ltd_angle_poly) : 
        ltd_angle_poly;
    }
    
    return boundaryPolygon;
  } 
  
 /**
  * Construct a boundary polygon for a limited angle.
  * It should go from origin --> canvas edge intersection --> canvas corners, if any -->
  *   canvas edge intersection --> origin.
  * Warning: Does not check for whether this.config.hasLimitedAngle is true.
  * @return {PIXI.Polygon}
  * @private
  */
  _limitedAnglePolygon() {
    const { rMin, rMax } = this.config;
    const pts = [this.origin.x, this.origin.y];
    
    // two parts:
    // 1. get the rMin -- canvas intersection
    // 2. follow the boundaries in order, adding corners as necessary, until 
    //    rMax -- canvas intersection
    // Note: (2) depends on:
    //  (a) rMin is ccw to rMax and 
    //  (b) canvas.walls.boundaries are ordered clockwise
    
    const boundaries = [...canvas.walls.boundaries];
    
    
    if(this.config.debug) {
      // debug: confirm boundaries are ordered as expected
      if(boundaries[0]._nw.key !== 6553500 ||
         boundaries[0]._se.key !== -399769700 ||
         boundaries[1]._nw.key !== -399769700 ||
         boundaries[1]._se.key !== 399774300 ||
         boundaries[2]._nw.key !== -6548900 ||
         boundaries[2]._se.key !== 399774300 ||
         boundaries[3]._nw.key !== 6553500 || 
         boundaries[3]._se.key !== -6548900) {
       
         log(`_limitedAnglePolygon: canvas.walls.boundaries not in expected order.`);
       
         }
       
      // debug: confirm angles are arranged as expected   
      if(foundry.utils.orient2dFast(rMax.A, rMax.B, rMin.B) < 0) {
        log(`_limitedAnglePolygon: angles not arranged as expected.`);
      }
    }
    
    // Find the boundary that intersects rMin and add intersection point.
    // Store i, representing the boundary index.
    let i;
    const ln = boundaries.length;
    for(i = 0; i < ln; i += 1) {
      const boundary = boundaries[i];
      if(foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, boundary.A, boundary.B)) {
        // lineLineIntersection should be slightly faster and we already confirmed
        // the segments intersect
        const x = foundry.utils.lineLineIntersection(rMin.A, rMin.B, 
                                                     boundary.A, boundary.B);
        pts.push(x.x, x.y);
        break;
      }
    }
    
    // "walk" around the canvas edges 
    // starting with the rMin canvas intersection, check for rMax.
    // if not intersected, than add the corner point
    for(let j = 0; j < ln; j += 1) {
      i = (i + j) % 4;
      const boundary = boundaries[i];
      if(foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, boundary.A, boundary.B)) {
        const x = foundry.utils.lineLineIntersection(rMin.A, rMin.B, 
                                                     boundary.A, boundary.B);
        pts.push(x.x, x.y);
        break;
        
      } else {
        pts.push(boundary.B.x, boundary.B.y);
      }
    }
    
    pts.push(this.origin.x, this.origin.y);

    return new PIXI.Polygon(pts);
  }  
  
  /**
   * Get bounding box for the boundary polygon
   * Expand so that it definitely includes origin.
   * Warning: Does not check for this.config.hasBoundary
   * @private
   */
   _getBoundingBox() {     
     const bbox = this.config.boundaryPolygon.getBounds();
     bbox.ceil(); // force the box to integer coordinates.
     bbox.padToPoint(this.origin);
     
     // Expand out by 1 to ensure origin is contained 
     bbox.pad(1);
     
     return bbox;   
   }   
   
  /**
   * Construct array of edges from a bounding box.
   * @param {PIXI.Rectangle} bbox
   * @private
   */
   _getBoundingBoxEdges(bbox) {
     return [
       new MyPolygonEdge({ x: bbox.x, y: bbox.y }, 
                         { x: bbox.right, y: bbox.y }),
       new MyPolygonEdge({ x: bbox.right, y: bbox.y }, 
                         { x: bbox.right, y: bbox.bottom }),
       new MyPolygonEdge({ x: bbox.right, y: bbox.bottom }, 
                         { x: bbox.x, y: bbox.bottom }),
       new MyPolygonEdge({ x: bbox.x, y: bbox.bottom }, 
                         { x: bbox.x, y: bbox.y })          
     ];    
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
    
    
    // Step 5 - Intersect boundary
   
    if(this.config.hasBoundary) {
       t0 = performance.now();
       const poly = LinkedPolygon2.intersect(this, this.config.boundaryPolygon);
       this.points = poly.points;
       t1 = performance.now();
       if(this.config.debug) {
         console.log(`Clockwise intersect Boundary Polygon in ${(t1 - t0).toPrecision(2)}ms`);
       }
    }
    
    
    if(this.config.debug) {
      console.log(`Clockwise _constructPolygonPoints in ${(t1 - t0).toPrecision(2)}ms`);
      
      // Run the original and compare points
      const og_poly = ClockwiseSweepPolygon.create(this.origin, this.config);
      
      // round to nearest integer coordinates
      og_poly.points = og_poly.points.map(x => Math.round(x));
      
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
    const { type, hasBoundary, bbox } = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      // ignore edges not going through or in the boundary box
      if( hasBoundary && this._edgeOutsideBoundary(wall, bbox) ) continue;

      // ignore edges that are of a type that should be ignored
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
       
      const edge = MyPolygonEdge.fromWall(wall, type);
      this.edges.set(edge.id, edge);
    }

    // Add edges for the boundary
    if(hasBoundary) {
      // Add bounding box as edges
      const bbox_edges = this._getBoundingBoxEdges(bbox);
      
      // need to identify intersections with other edges
      // don't need to compare against each other b/c we know these boundaries
      // don't need canvas boundary because the bounding box will block
      const edges_array = Array.from(this.edges.values());
      bbox_edges.forEach(e => e.identifyIntersections(edges_array));
      bbox_edges.forEach(e => this.edges.set(e.id, e));  
    
    } else {
      // Add edges for the canvas boundary
      // technically, could treat canvas walls as polygon boundaries, 
      // but that would likely be slower
      for ( let boundary of canvas.walls.boundaries ) {
        const edge = MyPolygonEdge.fromWall(boundary, type);
        this.edges.set(edge.id, edge);
      }
    }
    
    // add custom edges
    // this._addCustomEdges();

  }
  
  /**
   * Restrict edges by bounding box of the boundary polygon.
   * If completely outside, drop.
   * (if one vertex inside, keep, but outside vertex will be dropped by _identifyVertices)
   * @param {PolygonEdge} edge      Edge to test
   * @param {PIXI.Rectangle} bbox   Boundary box to test for inclusion
   * @return {boolean} True if edge can be dropped, false otherwise
   * @private
   */ 
   _edgeOutsideBoundary(edge, bbox) {
     // containsPoint should find anywhere an edge endpoint is in the bbox
     if(bbox.containsPoint(edge.A)) return false;
     if(bbox.containsPoint(edge.B)) return false;
       
     // keep edges that go through the bbox
     if(bbox.lineSegmentIntersects(edge.A, edge.B)) return false;
       
     return true;                                                                                                            
   } 
   
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
  */
  _addCustomEdges() {
    const { customEdges, type } = this.config;
    
    if(!customEdges || customEdges.length === 0) return;
    
    // Need to track intersections for each edge.
    // Cannot guarantee the customEdges have intersections set up, so 
    // process each in turn
    const edges_array = Array.from(this.edges.values());
    for( const data of customEdges ) {
      const edge = new MyPolygonEdge(data.A, data.B, data[type]);
      edge.identifyIntersections(edges_array);                              
      this.edges.set(edge.id, edge);
      edges_array.push(edge);
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

    }

    // Add edge intersections
    this._identifyIntersections();

    if(this.config.hasBoundary) {
      // Restrict vertices outside the bounding box
      const bbox = this.config.bbox;
      for(let vertex of this.vertices.values()) {
        if(!bbox.containsPoint(vertex)) this.vertices.delete(vertex.key);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Add additional vertices for intersections between edges.
   * @param {Map<string,MyPolygonEdge>} wallEdgeMap    A mapping of wall IDs to MyPolygonEdge instances
   * @private
   */
  _identifyIntersections() {
    const processed = new Set();
    for ( let edge of this.edges.values() ) {

      // Check each intersecting wall
      if(edge.wall && edge.wall.intersectsWith.size) { 
        for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

          // Some other walls may not be included in this polygon
          const other = this.edges.get(wall.id);
          if ( !other || processed.has(other) ) continue;

          // Verify that the intersection point is still contained within the radius?
          // test against bbox.contains?
        
          this._registerIntersection(edge, other, i);
        }
      }
      
      if(edge.tempIntersectsWith.size) {
        for( let [wall, i] of edge.tempIntersectsWith.entries() ) {
          const other = this.edges.get(wall.id);
          if ( !other || processed.has(other) ) continue;
        
          // Verify that the intersection point is still contained within the radius?
          // test against bbox.contains?
        
          this._registerIntersection(edge, other, i);
        }
      }
      processed.add(edge);
    }
  }
  
 /**
  * Moved from Foundry 9.236 _identifyIntersections to allow easy processing of
  * temporary edge intersections using separate loop.
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
  
  
  /* -------------------------------------------- */
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { radiusMax } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPointSquared(origin, vertex, radiusMax);
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
    for ( let edge of this.edges.values() ) {
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
    // not needed b/c canvas is always bound and not using limited radius rays
//     if ( minimumDistance < 1 ) {
//       const t = PolygonVertex.fromPoint(ray.B, {distance: 1});
//       if ( !points.has(t.key) ) collisions.push(t);
//     }
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
  

/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
function compareXY(a, b) {
  if ( a.x === b.x ) return a.y - b.y;
  else return a.x - b.x;
}

class MyPolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    // NOTE: A and B must be changeable
    // _identifyVertices sets A ccw to B. This is so activeEdges can test for end vertices.
    
  
    this.A = new PolygonVertex(a.x, a.y);
    this.B = new PolygonVertex(b.x, b.y);
    this.type = type;
    this.wall = wall; // || this;
    this.id = wall?.id || foundry.utils.randomID();
    
    this._nw = undefined;
    this._se = undefined;
    this._edgeKeys = undefined;
    
/*
intersectsWith: three options when temp edges are used.
1. Always use the wall.intersectsWith map. 
   Create wall.intersectsWith if wall is undefined. 
   Track and remove temp edges from intersectsWith 
     by replicating Wall.prototype._removeIntersections.
   Tracking and deletion could be slow. 

2. Copy the wall.intersectsWith map to edge.intersectsWith. 
   Copy such that the original map is not disturbed; i.e., new Map(wall.intersectsWith).
   Likely slower but faster than 1.

3. Create another intersectsWith map at edge.intersectsWith. 
   Check both in code.
   Complicated; possibly faster. 
   
(1) seems problematic b/c deletion means looping through all the intersectsWith entries.
   
*/

    // version (2) of intersectsWith options.
    //this.intersectsWith = wall ? new Map(wall.intersectsWith) : new Map();
    
    // version (3) of intersectsWith options.
    this.tempIntersectsWith = new Map();
  }
  
 /**
  * Locate the "northwest" vertex of this edge
  * Used for locating intersections.
  * @type {PolygonVertex}
  */ 
  get nw() {
    if(!this._nw) {
      const c = compareXY(this.A, this.B);
      this._nw = c < 0 ? this.A : this.B;
      this._se = c < 0 ? this.B : this.A;
    }
    return this._nw;
  } 

 /**
  * Locate the "southeast" vertex of this edge
  * Used for locating intersections.
  * @type {PolygonVertex}
  */ 
  get se() {
    if(!this._se) {
      const c = compareXY(this.A, this.B);
      this._nw = c < 0 ? this.A : this.B;
     this._se = c < 0 ? this.B : this.A;
    }
    return this._se;
  }
 
 /**
  * Get the set of keys corresponding to this edge's vertices.
  * @type {Set[integer]}
  */
  get edgeKeys() {
    return this._edgeKeys || (this._edgeKeys = new Set([this.A.key, this.B.key]));
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
  
 /** 
  * Sort and compare pairs of walls progressively from NW to SE
  * Comparable to inside loop of Wall.prototype.identifyWallIntersections.
  * Update this intersectsWith Map and their respective intersectsWith Map accordingly.
  * @param {MyPolygonEdge2[]} edges
  */
  identifyIntersections(edges) {
    edges.sort((a, b) => compareXY(a.nw, b.nw));
      
    // iterate over the other edge.walls
    const ln = edges.length;
    for(let j = 0; j < ln; j += 1) {
      const other = edges[j];
      
      // if we have not yet reached the left end of this edge, we can skip
      if(other.se.x < this.nw.x) continue;
    
      // if we reach the right end of this edge, we can skip the rest
      if(other.nw.x > this.se.x) break;
    
      this._identifyIntersectionsWith(other);
    }
  }
  
 /**
  * Record the intersection points between this wall and another, if any.
  * Comparable to Wall.prototype._identifyIntersectionsWith
  * @param {PolygonEdge2} other   The other edge.
  */
  _identifyIntersectionsWith(other) {
    // if ( this === other ) return;
    
    // Ignore walls which share an endpoint
    if ( this.edgeKeys.intersects(other.edgeKeys) ) return;
    
    const wa = this.A;
    const wb = this.B;
    const oa = other.A;
    const ob = other.B;

    // Record any intersections
    if ( !foundry.utils.lineSegmentIntersects(wa, wb, oa, ob) ) return;
    const x = foundry.utils.lineLineIntersection(wa, wb, oa, ob);
    if ( !x ) return;  // This eliminates co-linear lines
    this.tempIntersectsWith.set(other, x);
    other.tempIntersectsWith.set(this, x);
  }
}

