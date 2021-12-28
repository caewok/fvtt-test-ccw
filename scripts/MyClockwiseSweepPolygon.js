/* globals 

PolygonVertex, 
PolygonEdge,
ClockwiseSweepPolygon,
CONST,
foundry,
PIXI,
canvas,
game,

*/

'use strict';

import { LinkedPolygon } from "./LinkedPolygon.js";
import { log, MODULE_ID } from "./module.js";


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

export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {

  /**
   * Additional config options:
   * - boundaryPolygon (user or calculated) 
   * - customEdges  (user)
   * - hasBoundary (calculated)
   */
  initialize(origin, config) {
    super.initialize(origin, config);
    const cfg = this.config;   
    
    // determine if a boundary is necessary
    // assume if the user provided one, it is not necessary
    // TO-DO: Should this still intersect the radius and limited angle boundaries
    //        against a user-provided boundary polygon?
    cfg.hasBoundary = Boolean(cfg.boundaryPolygon) || cfg.hasLimitedRadius || cfg.hasLimitedAngle; 
    
    // construct the boundary polygon if needed
    if(cfg.hasBoundary && !cfg.boundaryPolygon) {
      if(cfg.hasLimitedRadius) {
        const circle = new PIXI.Circle(this.origin.x, this.origin.y, cfg.radius);
        cfg.boundaryPolygon = circle.toPolygon(cfg.density);
      }
      
      if(cfg.hasLimitedAngle) {
        const ltd_angle_poly = this._limitedAnglePolygon();
        // if necessary, find the intersection of the radius and limited angle polygons
        cfg.boundaryPolygon = cfg.hasLimitedRadius ? 
          LinkedPolygon.intersect(cfg.boundaryPolygon, ltd_angle_poly) : 
          ltd_angle_poly;
      }
    }
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
    
    // debug: confirm boundaries are ordered as expected
    if(game.modules.get(MODULE_ID).api.debug) {
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
   * Add a Step 5 to intersect the boundary with the calculated polygon
   */
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
    }
     
    if(this.config.hasBoundary) {
       t0 = performance.now();
       const poly = LinkedPolygon.intersect(this, this.config.boundaryPolygon);
       this.points = poly.points;
       t1 = performance.now();
       if(this.config.debug) {
         console.log(`Clockwise intersect Boundary Polygon in ${(t1 - t0).toPrecision(2)}ms`);
       }
    }  
   }
   
  /**
   * Changes to _identifyEdges:
   * 1. no longer constrain by limited angle or radius
   * 2. if cfg.boundaryPolygon:
   *    - add bounding rectangle as edges
   *    - restrict edges based on bounding rectangle
   * Why not just add the boundary Polygon?
   * a. It could be complicated with a lot of additional vertices (think circle)
   * b. Would have more edges requiring intersection tests.
   * c. Boundary Polygon may go through origin or (rarely) not include it at all.
   *    This would mess up the sweep algorithm, so we adjust the bounding box accordingly.
   */
   _identifyEdges() {
     const {type, hasBoundary} = this.config;
     
    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
      const edge = MyPolygonEdge.fromWall(wall, type);
      this.edges.add(edge);
    }
    

    // needs to happen before _restrictEdgesByBoundingBox and later processing. 
    this._addCustomEdges();
    
    if(hasBoundary) {
      // Add bounding box as edges
      const bbox = this._getBoundingBox();
      const bbox_edges = this._getBoundingBoxEdges(bbox);
      
      // need to identify intersections with other edges
      // don't need to compare against each other b/c we know these boundaries
      // don't need canvas boundary because the bounding box will block
      const edges_array = Array.from(this.edges);
      bbox_edges.forEach(e => e.identifyIntersections(edges_array));
      bbox_edges.forEach(e => this.edges.add(e));  
      
      // remove edges not going through or in the bounding box
      this._restrictEdgesByBoundingBox(bbox);
    
    } else {
      // Add edges for the canvas boundary
      // technically, could treat canvas walls as polygon boundaries, 
      // but that would likely be slower
      for ( const boundary of canvas.walls.boundaries ) {
        this.edges.add(MyPolygonEdge.fromWall(boundary, type));
      }
    }
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
    for( const data of customEdges ) {
      const edge = new MyPolygonEdge(data.A, data.B, data[type]);
      
      // to track intersections
      // there is probably a better way to do this so not always converting 
      // this.edges to an Array
      const edges_array = Array.from(this.edges);
      edge.identifyIntersections(edges_array);                              
      this.edges.add(edge);
    }
  }
   
  /**
   * Get bounding box for the boundary polygon
   * Expand so that it definitely includes origin.
   * Warning: Does not check for this.config.hasBoundary
   * @private
   */
   _getBoundingBox() {
     const { boundaryPolygon } = this.config;
     
     const bbox = boundaryPolygon.getBounds();
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
   
  /**
   * Restrict edges by bounding box of the boundary polygon.
   * If completely outside, drop.
   * (if one vertex inside, keep, but outside vertex will be dropped by _identifyVertices)
   * @private
   */ 
   _restrictEdgesByBoundingBox(bbox) {
     for( let edge of this.edges ) {
       // containsPoint should find anywhere an edge endpoint is in the bbox
       if(bbox.containsPoint(edge.A)) continue;
       if(bbox.containsPoint(edge.B)) continue;
       
       // keep edges that go through the bbox
       if(bbox.lineSegmentIntersects(edge.A, edge.B)) continue;
       
       this.edges.delete(edge);                                                                                                                   
     }
   }
   
  /**
   * Changes to _identifyVertices:
   * 1. No limited angles
   * 2. Always record the wall->edge mapping
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
      //if ( edge.wall ) wallEdgeMap.set(edge.id, edge);
      wallEdgeMap.set(edge.id, edge);
    }

    // Add edge intersections
    this._identifyIntersections(wallEdgeMap);
  } 
  
 /**
  * Changes to _identifyIntersections:
  * - No limited angle processing
  * - Using MyPolygonEdge, so edge.intersectsWith, not edge.wall.intersectsWith
  */
  _identifyIntersections(wallEdgeMap) {     
    const processed = new Set();
    for ( let edge of this.edges ) {

      // If the edge has no intersections, skip it
      if ( !edge.intersectsWith.size ) continue;

      // Check each intersecting wall
      for ( let [id, i] of edge.intersectsWith.entries() ) {

        // Some other walls may not be included in this polygon
        const other = wallEdgeMap.get(id);
        if ( !other || processed.has(other) ) continue;

        // Verify that the intersection point is still contained within the radius
        // I don't think this is necessary anymore:
        // const r2 = Math.pow(i.x - o.x, 2) + Math.pow(i.y - o.y, 2);
        // if ( r2 > this.config.radius2 ) continue;

        // Register the intersection point as a vertex
        let v = PolygonVertex.fromPoint(i);
        if ( this.vertices.has(v.key) ) v = this.vertices.get(v.key);
        else {      
          this.vertices.set(v.key, v);
        }
        if ( !v.edges.has(edge) ) v.attachEdge(edge, 0);
        if ( !v.edges.has(other) ) v.attachEdge(other, 0);
      }
      processed.add(edge);
    }
  }
  
 /** 
  * Changes to _executeSweep:
  * No isRequired in the result
  * Not replicating _executeSweep for now, as that shouldn't affect anything
  */
  
 /**
  * Changes to _sortVertices:
  * - Reference point is no longer relevant. 
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
  
 /**
  * Changes to _determineRayResult:
  * - Drop case 1 (result.isRequired)
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
  
 /**
  * Changes to _constructPolygonPoints:
  * - No limited radius padding
  * - No special handling for limited angle
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
    
}

/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
function compareXY(a, b) {
  if(a.x === b.x) {
    if(a.y === b.y) { return 0; }
    return a.y < b.y ? -1 : 1;
  } else {
    return a.x < b.x ? -1 : 1; 
  }
}

class MyPolygonEdge extends PolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    super(a, b, type, wall);
    

    this._A = this.A;
    this._B = this.B;
    
    this._leftEndpoint = undefined;
    this._rightEndpoint = undefined; 
    
    // Need to copy the existing wall intersections in an efficient manner
    // Temporary walls may add more intersections, and we don't want those 
    // polluting the existing set.
    this.intersectsWith = new Map();
    
    if(this.wall) {
      this.id = this.wall.id; // copy the id so intersectsWith will match for all walls.
      this.wall.intersectsWith.forEach((x, key) => {
        // key was the entire wall; just make it the id for our purposes
        this.intersectsWith.set(key.id, x);
      });
      
    } else {
      this.id = foundry.utils.randomID();
    }
  }
  
 /**
  * Identify which endpoint is further west, or if vertical, further north.
  * @type {Point}
  */
  get leftEndpoint() {
    if(typeof this._leftEndpoint === "undefined") {
      const is_left = compareXY(this.A, this.B) === -1;
      this._leftEndpoint = is_left ? this.A : this.B;
      this._rightEndpoint = is_left ? this.B : this.A;
    }
    return this._leftEndpoint;
  }
  
 /**
  * Identify which endpoint is further east, or if vertical, further south.
  * @type {Point}
  */
  get rightEndpoint() {
    if(typeof this._rightEndpoint === "undefined") {
      this._leftEndpoint = undefined;
      this.leftEndpoint; // trigger endpoint identification
    }
    return this._rightEndpoint;
  }
  
  // We need to use setters for A and B so we can reset the left/right endpoints
  // if A and B are changed
  
 /**
  * @type {Point}
  */ 
  get A() {
    return this._A;    
  }
  
 /**
  * @type {Point}
  */  
  set A(value) {
    if(!(value instanceof PolygonVertex)) { value = new PolygonVertex(value.x, value.y); }
    this._A = value;
    this._leftEndpoint = undefined;
    this._rightEndpoint = undefined;
  }

 /**
  * @type {Point}
  */ 
  get B() {
    return this._B;
  }

 /**
  * @type {Point}
  */ 
  set B(value) {
    if(!(value instanceof PolygonVertex)) { value = new PolygonVertex(value.x, value.y); }
    this._B = value;
    this._leftEndpoint = undefined;
    this._rightEndpoint = undefined;
  }
  
 /**
  * Compare function to sort by leftEndpoint.x, then leftEndpoint.y coordinates
  * @param {MyPolygonEdge} a
  * @param {MyPolygonEdge} b
  * @return {-1|0|1}
  */
  static compareXY_LeftEndpoints(a, b) {
    return compareXY(a.leftEndpoint, b.leftEndpoint);
  }

 /** 
  * Given an array of MyPolygonEdges, identify intersections with this edge.
  * Update this intersectsWith Map and their respective intersectsWith Map accordingly.
  * Comparable to identifyWallIntersections method from WallsLayer Class
  * @param {MyPolygonEdges[]} edges
  */
  identifyIntersections(edges) {
    edges.sort(MyPolygonEdge.compareXY_LeftEndpoints);
  
    const ln = edges.length;
    // Record endpoints of this wall
    // Edges already have PolygonVertex endpoints, so pull the key
    const wallKeys = new Set([this.A.key, this.B.key]);
  
    // iterate over the other edge.walls
    for(let j = 0; j < ln; j += 1) {
      const other = edges[j];
    
      // if we have not yet reached the left end of this edge, we can skip
      if(other.rightEndpoint.x < this.leftEndpoint.x) continue;
    
      // if we reach the right end of this edge, we can skip the rest
      if(other.leftEndpoint.x > this.rightEndpoint.x) break;
    
      // Ignore edges that share an endpoint
      const otherKeys = new Set([other.A.key, other.B.key]);
      if ( wallKeys.intersects(otherKeys) ) continue;
    
      // Record any intersections
      if ( !foundry.utils.lineSegmentIntersects(this.A, this.B, other.A, other.B) ) continue;
    
      const x = foundry.utils.lineLineIntersection(this.A, this.B, other.A, other.B);
      if(!x) continue; // This eliminates co-linear lines
  
      this.intersectsWith.set(other.id, x);
      other.intersectsWith.set(this.id, x);
    }
  }
  
}