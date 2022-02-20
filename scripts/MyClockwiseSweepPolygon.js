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

//import { LinkedPolygon } from "./LinkedPolygon.js";
//import { SimplePolygon } from "./SimplePolygon.js";
//import { log } from "./module.js";
import { pixelLineContainsPoint, compareXY } from "./utilities.js";
import { SimplePolygonEdge2 as SimplePolygonEdge, SimplePolygon2 as SimplePolygon } from "./SimplePolygon2.js";

/*
Basic concept: 
Create limited radius or limited angle by intersecting a shape with the basic
ClockwiseSweep computed polygon.

Changes to ClockwiseSweep:
- Walls are trimmed only by an encompassing rectangle. Radius is converted to rectangle.
- All limited radius or limited angle calculations are removed.
- After points are computed, use SimplePolygon.intersect to trim the fov to the desired  shape.
- User can specify a boundaryPolygon in config. If specified, it will override limited radius and limited angle shapes. If not specified, one will be calculated as needed for limited radius or limited angle.
- Optional: user can specify custom edges to add to the sweep. Used to cache walls for unique shapes (e.g., river boundary or road boundary) that affect only certain light or sound objects. Could also be used to limit token vision in unique, custom ways.

Changes to PolygonEdge:
- Need to handle edges that are not associated with a wall
- Need to be able to quickly identify intersections for a given edge
  (Use the left/right endpoint sort algorithm comparable to walls intersection)
  
  
getBoundaryEdges: Return edges for a boundary, with intersections processed
edgeOutsideBoundary: True if the edge does not cross and is not contained by the boundary
vertexOutsideBoundary: True if the vertex does not cross and is not contained by the boundary 



*/


export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {
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
    this.edges = new Map();
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
    
     
    // Configure limited angle
    // aMin, aMax, rMin, rMax now configured in _limitedAnglePolygon.
    // Done there because we tweak the origin point to create a valid boundary.
    cfg.aMin = undefined;
    cfg.aMax = undefined;
    cfg.rMin = undefined;
    cfg.rMax = undefined;
    
    // configure starting ray
    // (always due west; limited angle now handled by _limitedAnglePolygon)
    cfg.rStart = new Ray(origin, { x: origin.x - cfg.radiusMax, y: origin.y });
    
    // Configure artificial boundary
    // boundaryPolygon is user-provided. It overrides use of the circle radius.
    // Otherwise, if a boundary is required (beyond canvas edges)
    // the limited radius and/or limited circle provide it.
    // boundaryPolygon can be combined with limitedRadius.
    
    // Conceptually, it might make sense to require the boundaryPolygon to be 
    // centered at 0,0 and scalable, such that radius 1 gives the boundaryPolygon
    // as-is, and this configuration would then scale and shift it according to 
    // provided origin and radius.
    
    // Boundary must be a closed polygon. 
    cfg.hasBoundary = Boolean(cfg.boundaryPolygon) || 
                      cfg.hasLimitedRadius || 
                      cfg.hasLimitedAngle; 
                      
    // It is possible and conceptually simpler to treat limited angle like a
    // boundaryPolygon: 
    // - use a bounding box to trim edges and vertices
    // - otherwise ignore until end of sweep and then intersect the sweep polygon
    //   with the limited radius polygon.
    // This works but is slow. The intersection is okay speedwise, but trimming 
    // vertices and edges only by the bounding box, not the limited angle, brings in 
    // a lot more vertices to the sweep on more complicated maps with limited angle,
    // unlimited radius token vision.
    
    // Polygon representing the limited angle:
    // From 1 pixel behind the actual origin along rMin to the canvas border, then 
    // along the canvas border to rMax, then back to 1 pixel behind the actual origin.
    if(cfg.hasLimitedAngle) { cfg.limitedAnglePolygon = this._limitedAnglePolygon(); }
    
    // Limited Radius boundary represented by PIXI.Circle b/c it is much faster to 
    // intersect a circle with a polygon than two equivalent polygons.
    if(cfg.hasLimitedRadius && !cfg.boundaryPolygon) {
       cfg.limitedRadiusCircle = new PIXI.Circle(this.origin.x, 
                                                this.origin.y, 
                                                this.config.radius);
    }
    
    // Build a bounding box (PIXI.Rectangle)
    // Edge and vertex removal done by testing against bounding box.
    // (Limited angle treated as special case; vertices also rejected if not within the 
    //  limited angle, for speed.)
    if(cfg.hasBoundary) { cfg.bbox = this._getBoundingBox(); }
    
    // User can also provide data to add temporary edges to the sweep algorithm.
           
    // for debugging 
    cfg.intersectMethod = cfg.intersectMethod || "simple"; // "simple" or "clipper"       
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
        
    if(this.config.debug) { this._sweepPoints = [...this.points]; }
    
    const { boundaryPolygon, limitedRadiusCircle } = this.config;
    
    
    // Step 5 - Intersect boundary
    
    // If we have a boundary, intersect it
    // Recall that we are not treating limitedAnglePolygon as a regular boundaryPolygon
    // because limited angle was already handled in the sweep.
    
    // (Limited angle is 1 pixel off the origin so it works in the sweep. We could
    //  re-intersect here with the correct polygon, but that would likely just 
    //  introduce visual discrepancies given the differing angles.)
   
    // If we did want to intersect the limitedAnglePolygon, we should do so 
    // before intersecting limitedRadiusCircle. 
    // (limitedRadiusCircle should always be intersected last b/c it creates a complicated
    // polygon shaped similar to a circle with a lot of edges.)
    
    // Jump early if nothing to intersect
    // need three points (6 coords) to form a polygon to intersect
    if(this.points.length < 6) return;
    
    if(boundaryPolygon || limitedRadiusCircle) {        
       const poly = boundaryPolygon ? 
              this._intersectPolygons(this, boundaryPolygon) :
              this._intersectPolygons(this, limitedRadiusCircle)
              
       // if poly is null (or undefined) something has gone wrong: no intersection found.
       // return the points or return empty points?
       // currently returning points
       
       if(poly) { 
         this.points = poly.points; 
         this._isClosed = poly._isClosed;
         this._isConvex = poly._isConvex;
         this._isClockwise = poly._isClockwise;  
       } else if(this.config.hasBoundary) {
         console.warn(`CW2|hasBoundary but poly is undefined.`, this)
       }
    }      
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
    const { type, hasBoundary } = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      // ignore edges that are of a type that should be ignored
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
      
      // *** NEW *** // 
      const edge = SimplePolygonEdge.fromWall(wall, type);
      this.edges.set(edge.id, edge);
      // *** END NEW *** //
    }
    
    if(!hasBoundary){
      // Add edges for the canvas boundary
      // technically, could treat canvas walls as polygon boundaries, 
      // but that would likely be slower
      for ( let boundary of canvas.walls.boundaries ) {
        const edge = SimplePolygonEdge.fromWall(boundary, type);
        this.edges.set(edge.id, edge);
      }
      
    // *** NEW *** //  
    } else {   
    // Add edges for the boundary
    //if(hasBoundary) {
      // Add bounding box as edges
      // don't need canvas boundary because the bounding box will block
      const boundary_edges = this._getBoundaryEdges();
      
      // need to identify intersections with other edges
      // don't need to compare against each other b/c we know these boundaries
      // don't need canvas boundary because the bounding box will block
      const edges_array = Array.from(this.edges.values());
      edges_array.sort((a, b) => compareXY(a.nw, b.nw));
      
      boundary_edges.forEach(e => e._identifyIntersections(edges_array, { sort: false }));
      
      boundary_edges.forEach(e => this.edges.set(e.id, e));  
    
    }    
        
    // add custom edges
    // this._addCustomEdges();
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
    if ( !this.config.hasBoundary ) return canvas.walls.placeables;
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
    if(this.config.hasBoundary) {
      // Restrict vertices outside the bounding box
      //const bbox = this.config.bbox;
      for(let vertex of this.vertices.values()) {
        vertex.is_outside = this._vertexOutsideBoundary(vertex);
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
      if(edge.wall && edge.wall.intersectsWith.size) { 
        for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

          // Some other walls may not be included in this polygon
          const other = this.edges.get(wall.id);
          if ( !other || processed.has(other) ) continue;

          // TO-DO: test intersection point  against bbox.contains?
        
          this._registerIntersection(edge, other, i);
        }
      }
      
      if(edge.intersectsWith.size) {
        for( let [wall, i] of edge.intersectsWith.entries() ) {
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

      let result
      if(vertex.is_outside) {
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
  * Construct a boundary polygon for a limited angle.
  * It should go from origin --> canvas edge intersection --> canvas corners, if any -->
  *   canvas edge intersection --> origin.
  * Warning: Does not check for whether this.config.hasLimitedAngle is true.
  * @return {PIXI.Polygon}
  * @private
  */
  _limitedAnglePolygon() {
    const { angle, rotation, radiusMax } = this.config;
    
    // move the origin slightly back from actual origin, so the limited angle polygon
    // includes the origin
    
    // trick here is that origin and this shifted origin may both be floating point, 
    // but ray intersections use PolygonVertex, which will round target vertex 
    // to an integer. This will cause the ray shot from this.origin to the 
    // shifted origin to move around wildly when, say, dragging a light with
    // CONFIG.debug.polygons = true. 
    // We would prefer to stay in line with the origin so the angles better match. 
    // With that in mind, _initialize now rounds origin to the nearest point.
    // Here, we also round the origin offset. 
    // 
    
    const r = Ray.fromAngle(this.origin.x, this.origin.y, 
                            Math.toRadians(rotation + 90), -1)
    const origin = { x: Math.round(r.B.x), y: Math.round(r.B.y) };
            
    const aMin = Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2)));
    const aMax = aMin + Math.toRadians(angle);
    
    const rMin = Ray.fromAngle(origin.x, origin.y, aMin, radiusMax);
    const rMax = Ray.fromAngle(origin.x, origin.y, aMax, radiusMax);
    
    // store rMin and rMax for visualization
    this.config.rMin = rMin;
    this.config.rMax = rMax;
    
    const pts = [origin.x, origin.y];
    
    // two parts:
    // 1. get the rMin -- canvas intersection
    // 2. follow the boundaries in order, adding corners as necessary, until 
    //    rMax -- canvas intersection
    // Note: (2) depends on:
    //  (a) rMin is ccw to rMax and 
    //  (b) canvas.walls.boundaries are ordered clockwise
    
    const boundaries = [...canvas.walls.boundaries];
    
    
//     if(this.config.debug) {
//       // debug: confirm boundaries are ordered as expected
//       if(boundaries[0].nw.key !== 6553500 ||
//          boundaries[0].se.key !== -399769700 ||
//          boundaries[1].nw.key !== -399769700 ||
//          boundaries[1].se.key !== 399774300 ||
//          boundaries[2].nw.key !== -6548900 ||
//          boundaries[2].se.key !== 399774300 ||
//          boundaries[3].nw.key !== 6553500 || 
//          boundaries[3].se.key !== -6548900) {
//        
//          log(`_limitedAnglePolygon: canvas.walls.boundaries not in expected order.`);
//        
//          }
//        
//       // debug: confirm angles are arranged as expected   
//       if(foundry.utils.orient2dFast(rMax.A, rMax.B, rMin.B) < 0 && angle < 180 ||
//          foundry.utils.orient2dFast(rMax.A, rMax.B, rMin.B) > 0 && angle > 180) {
//         log(`_limitedAnglePolygon: angles not arranged as expected.`);
//       } 
//     }
    
    // token rotation: 
    // north is 180º (3.1415 or π radians)
    // west is 90º (1.5707 or π/2 radians)
    // south is 0º (0 radians)
    // east is 270º (-1.5707 or -π/2 radians)
    // aMin, aMax could be used to guess the starting boundary
    // Example: if aMin is due north, it must intersect the due north boundary
    //          if aMin is north/north-east, it could intersect due north or due east
    
    
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
    // if greater than 180º angle, don't start with rMin intersection b/c we need to 
    // circle around
    if(angle > 180) {
      const boundary = boundaries[i];
      pts.push(boundary.B.x, boundary.B.y);
      i = i + 1; 
    }
    
    for(let j = 0; j < ln; j += 1) {
      const new_i = (i + j) % 4;
      const boundary = boundaries[new_i];
      if(foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, boundary.A, boundary.B)) {
        const x = foundry.utils.lineLineIntersection(rMax.A, rMax.B, 
                                                     boundary.A, boundary.B);
        pts.push(x.x, x.y);
        break;
        
      } else {
        pts.push(boundary.B.x, boundary.B.y);
      }
    }
    
    pts.push(origin.x, origin.y);
    
    const new_poly = new PIXI.Polygon(pts);
    // set known qualities
    new_poly._isClosed = true;
    new_poly._isClockwise = true;
    // may or may not be convex. Should be if the angle is less than 180º, but probably
    // not critical either way. Convexity mainly used at the moment to speed up the 
    // clockwise determination.

    return new_poly;
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
   _getBoundingBox() {     
     const { boundaryPolygon, 
             hasLimitedAngle, 
             hasLimitedRadius, 
             limitedAnglePolygon, 
             limitedRadiusCircle } = this.config;
   
     // either use the user-provided boundaryPolygon or the limited angle/limited radius   
     let bbox;  
     if(boundaryPolygon) {
       bbox = boundaryPolygon.getBounds();
     } else if(hasLimitedAngle && hasLimitedRadius) {
       const bbox_angle = limitedAnglePolygon.getBounds();
       const bbox_circle = limitedRadiusCircle.getBounds();
       bbox = bbox_angle.intersection(bbox_circle);
     } else if(hasLimitedAngle) {
       bbox = limitedAnglePolygon.getBounds();
     } else if(hasLimitedRadius) {
       bbox = limitedRadiusCircle.getBounds();
     }
     
     if(!bbox) return undefined; // just in case.
        
     // convert to NormalizedRectangle, which is expected by _getWalls.
     // should probably be handled by the respective getBounds methods above.
     bbox = new NormalizedRectangle(bbox.x, bbox.y, bbox.width, bbox.height); 
        
     bbox.ceil(); // force the box to integer coordinates.
     
     // expand to definitely include origin (otherwise, sweep algorithm could fail)
     bbox.padToPoint(this.origin);
     
     // Expand out by 1 to ensure origin is contained 
     bbox.pad(1);
     
     return bbox;   
   }   


  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */
  
  /**
   * Construct array of edges from a bounding box.
   * If limited angle and no 
   * @private
   */
   _getBoundaryEdges() {
     const { bbox, boundaryPolygon, hasLimitedAngle, limitedAnglePolygon } = this.config;
     
     const boundary_edges = [];
     
     // TO-DO:
     // Right now, either the limited angle walls are returned or the bounding box.
     // If limited radius + limited angle, could instead intersect the radius bbox 
     // and the limited angle polygon and return those walls. 
     // (could just return the full edge set for limited angle polygon and bbox, 
     //  but that would be a lot more unnecessary edges)
     
     if(!boundaryPolygon && hasLimitedAngle) {
       const ptsIter = limitedAnglePolygon.iteratePoints(); // includes close
       let prevPt = ptsIter.next().value;
       for(const pt of ptsIter) {
         boundary_edges.push(new SimplePolygonEdge(prevPt, pt));
         prevPt = pt;
       }            
     } else {
       boundary_edges.push(
           new SimplePolygonEdge({ x: bbox.x, y: bbox.y }, 
                             { x: bbox.right, y: bbox.y }),
           new SimplePolygonEdge({ x: bbox.right, y: bbox.y }, 
                             { x: bbox.right, y: bbox.bottom }),
           new SimplePolygonEdge({ x: bbox.right, y: bbox.bottom }, 
                             { x: bbox.x, y: bbox.bottom }),
           new SimplePolygonEdge({ x: bbox.x, y: bbox.bottom }, 
                             { x: bbox.x, y: bbox.y }));   
    } 

    return boundary_edges;   
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
  * @private
  */
  _addCustomEdges() {
    const { customEdges, type } = this.config;
    
    if(!customEdges || customEdges.length === 0) return;
    
    // Need to track intersections for each edge.
    // Cannot guarantee the customEdges have intersections set up, so 
    // process each in turn.
    // Thus, cannot sort edges_array in advance; must let identifyIntersections
    // re-sort at each addition.
    const edges_array = Array.from(this.edges.values());
    for( const data of customEdges ) {
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
    const { bbox, limitedAnglePolygon, rMin, rMax, angle } = this.config;
        
    if(limitedAnglePolygon) {
      //return limitedAnglePolygon.clipperContains(v) === 0; // -1 if on, 1 if within
      // could just use the bbox but better to eliminate as many as possible.
      // use the rays to remove
      // keep points within a short distance of the ray, to avoid losing points on the ray
      const is_outside_rays = !this.constructor.pointBetweenRays(v, rMin, rMax, angle) &&
                              !pixelLineContainsPoint(rMin, v, 2) &&
                              !pixelLineContainsPoint(rMax, v, 2);
      return is_outside_rays;
      
    }
    
    return !bbox.containsPoint(v);
  } 
  
  /* -------------------------------------------- */
  /*  Polygon Identification                      */
  /* -------------------------------------------- */
  
 /**
  * Helper to select best method to intersect two polygons
  * @param {PIXI.Polygon|PIXI.Circle} poly1
  * @param {PIXI.Polygon|PIXI.Circle} poly2
  */ 
  _intersectPolygons(poly1, poly2) {
    // use circle method to process intersection if we have a circle
    if(poly1 instanceof PIXI.Circle) 
      return poly1.polygonIntersect(poly2, { density: this.config.density });
      
    if(poly2 instanceof PIXI.Circle) 
      return poly2.polygonIntersect(poly1, { density: this.config.density });  
      
    if(this.config.intersectMethod === "clipper") {
      return poly1.clipperClip(poly2, { cliptype: ClipperLib.ClipType.ctIntersection });  
    }  
    return SimplePolygon.intersect(poly1, poly2);   
  }
}
 
