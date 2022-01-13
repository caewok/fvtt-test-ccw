/* globals
PIXI,
foundry,
PolygonVertex,
PolygonEdge,
CONST
*/

'use strict';

//import { log } from "./module.js";

import { keyForPoint } from "./utilities.js";


/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
function compareXY(a, b) {
  return a.x - b.x;
  // if ( a.x === b.x ) return a.y - b.y;
//   else return a.x - b.x;
}

/*
Given two PIXI.Polygon, find intersect or union using only the points array without
creating linked polygon. Hopefully faster than LinkedPolygon version.

1. Intersections
Construct two new PIXI.Polygons by locating intersections for each.
Add points accordingly, in order.

2. Clockwise walk
Get intersection or union by clockwise walk along points.
Use integer keys to determine shared coordinates.
*/


/*
intersectsWith: three options when temp edges are used in combination with existing walls
1. Always use the wall.intersectsWith map. 
   Create wall.intersectsWith if wall is undefined. 
   Track and remove temp edges from intersectsWith 
     by replicating Wall.prototype._removeIntersections.
   Tracking and deletion could be slow. 

2. Copy the wall.intersectsWith map to edge.intersectsWith. 
   Copy such that the original map is not disturbed; i.e., new Map(wall.intersectsWith).
   Likely slower but faster than 1.
   e.g. this.intersectsWith = wall ? new Map(wall.intersectsWith) : new Map();

3. Create another intersectsWith map at edge.intersectsWith. 
   Check both in code.
   A bit complicated; possibly faster than 1 or 2. 
   e.g., this.intersectsWith = new Map();
   
(1) seems problematic b/c deletion means looping through all the intersectsWith entries.
Going with (3) for speed plus the intersectsAt is useful for processing polygon intersections.
   
*/

export class SimplePolygonEdge2 extends PolygonEdge {

 /**
  * If LinkedPolygonVertex is passed, it will be referenced as is.
  * @param a {Point|LinkedPolygonVertex}
  * @param b {Point|LinkedPolygonVertex}
  */
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    super(a, b, type, wall);
    
    this.A = new PolygonVertex(a.x, a.y);
    this.B = new PolygonVertex(b.x, b.y);
    
        
    // Track wall ids if this edge corresponds to existing wall
    // This replaces wallEdgeMap in ClockwiseSweep.
    this._id = undefined;
    
    // following used in finding intersections
    this._nw = undefined;
    this._se = undefined;
    this._edgeKeys = undefined; 
    
    this.intersectionKeys = new Set(); // keys of intersection vertices 
    this.intersectsWith = new Map();  // Map just as with wall.intersectsWith
    this._orderedIntersections = undefined; // Array of intersections arranged A...x...B
    
    // intersectsWith stores the other edge as the key and the intersection
    // Each intersection vertex has a Map at v.edges linking the two edges
    // (see _addIntersectionPoint below)
  }
  
  
 // existing methods from PolygonEdge:
 // isLimited, fromWall 

 /**
  * Get the id for this edge (needed for sweep, but not for general intersections)
  */
  get id() {
    return this._id || (this._id = this.wall?.id || foundry.utils.randomID());
  }
  
 /**
  * Get the set of keys corresponding to this edge's vertices
  */
  get edgeKeys() {
    return this._edgeKeys || (this._edgeKeys = new Set([this.A.key, this.B.key]));
  } 

 /**
  * Identify which endpoint is further west, or if vertical, further north.
  * Required for quick intersection processing.
  * @type {PolygonVertex}
  */
  get nw() {
    if(!this._nw) {
       const is_nw = compareXY(this.A, this.B) < 0;
       this._nw = is_nw ? this.A : this.B;
       this._se = is_nw ? this.B : this.A;
    }
    return this._nw;
  }
  
 /**
  * Identify which endpoint is further east, or if vertical, further south.
  * @type {PolygonVertex}
  */
  get se() {
    if(!this._se) {
      const is_nw = compareXY(this.A, this.B) < 0;
      this._nw = is_nw ? this.A : this.B;
      this._se = is_nw ? this.B : this.A;
    }
    return this._se;
  }
  
 /**
  * Return array of intersections in order
  */ 
  get orderedIntersections() {
    return this._orderedIntersections || 
           (this._orderedIntersections = this._orderIntersections());
  } 
  
 /**
  * Helper to order intersections from A -- i0 -- i1 ... B
  * Ordered by finding distance squared from A.
  * @return {[PolygonVertex]}   Array of intersection vertices in order from A to B
  * @private
  */
  _orderIntersections() {
    const xs = [...this.intersectsWith.values()];
    
    if(xs.length < 2) return xs;
    
    // add distance measurements between each intersection and A and sort the array
    const x = this.A.x;
    const y = this.A.y;
    xs.map(i => { i._dist2 = Math.pow(i.x - x, 2) + Math.pow(i.y - y, 2); }); 
    xs.sort((a, b) => a._dist2 - b._dist2);
    
    return xs;
  } 
   
    
 /** 
  * Sort and compare pairs of walls progressively from NW to SE
  * Comparable to inside loop of Wall.prototype.identifyWallIntersections.
  * Update this intersectsWith Map and their respective intersectsWith Map accordingly.
  * @param {SimplePolygonEdge[]} edges   Must be sorted.
  * Options:
  * @param {boolean} sort   If true, sort the edges array before starting.
  * @param {boolean} intersecting_polygons If true, add intersection when B endpoints
  *                                        overlap. Avoid adding intersections with 
  *                                        A endpoints.
  */
  _identifyIntersections(edges, { sort = true, intersecting_polygons = false  } = {}) {
    if(sort) edges.sort((a, b) => compareXY(a.nw, b.nw));
    this._orderedIntersections = undefined; // just in case
      
    // iterate over the other edge.walls
    const ln = edges.length;
    const id_method = intersecting_polygons ? 
                        this._identifyPolygonIntersectionsWith :
                        this._identifyIntersectionsWith;
    
    for(let j = 0; j < ln; j += 1) {
      const other = edges[j];
      if(this === other) continue;
      
      other._orderedIntersections = undefined; // just in case
      
      // if we have not yet reached the left end of this edge, we can skip
      //if(other.se.x < this.nw.x) continue;
      if(other.max_x < this.min_x) continue;
    
      // if we reach the right end of this edge, we can skip the rest
      //if(other.nw.x > this.se.x) break;
      
    
      id_method.call(this, other);
    }
  }
  
 /**
  * Record the intersection points between this wall and another, if any.
  * Comparable to Wall.prototype._identifyIntersectionsWith
  * @param {SimplePolygonEdge} other   The other edge.
  * @private
  */
  _identifyIntersectionsWith(other) {      
    // If edges share 1 or 2 endpoints, break out
    if ( this.edgeKeys.intersects(other.edgeKeys) ) {
      return;
    }
    
    const wa = this.A;
    const wb = this.B;
    const oa = other.A;
    const ob = other.B;

    // Record any intersections
    if ( !foundry.utils.lineSegmentIntersects(wa, wb, oa, ob) ) return;
    const x = foundry.utils.lineLineIntersection(wa, wb, oa, ob);
    if ( !x ) return;  // This eliminates co-linear lines
    
    this._addIntersectionPoint(other, x);
  }

  
 /**
  * Record the intersection points between this wall and another, if any.
  * Comparable to Wall.prototype._identifyIntersectionsWith
  * Polygon version, meaning add intersection when B endpoints overlap. Avoid adding 
  * intersections with  A endpoints.
  * @param {SimplePolygonEdge} other   The other edge.
  * @private
  */
  _identifyPolygonIntersectionsWith(other) {    
    // If edges share 1 or 2 endpoints, break out
    if ( this.edgeKeys.intersects(other.edgeKeys) && this.B.key === other.B.key ) {
      // If these two edges both intersect at B, count as intersection point.
      // Other edges will intersect at A, or A with B. Don't count as that would
      // repeat intersections and cause problems with _tracePolygon. 
      this._addIntersectionPoint(other, other.B); 
      return;
    }
    
    const wa = this.A;
    const wb = this.B;
    const oa = other.A;
    const ob = other.B;

    // Record any intersections
    if ( !foundry.utils.lineSegmentIntersects(wa, wb, oa, ob) ) return;
    const x = foundry.utils.lineLineIntersection(wa, wb, oa, ob);
    if ( !x ) return;  // This eliminates co-linear lines
    
    // These edges form polygons, so we know the A and B vertices are shared. 
    // Thus only count intersections with the B vertices.
    // Avoids dealing with special cases in _tracePolygon.
    const key = keyForPoint(x);
    if(key === this.A.key || key === other.A.key) return;
  
    this._addIntersectionPoint(other, x);
  }
  
 /**
  * Helper to add an intersection point both this and other intersect sets.
  * @param {SimplePolygonEdge} other   The other edge. 
  * @param {Point} v                   Intersection to add. Must have {x, y} coordinates.
  * @private
  */
  _addIntersectionPoint(other, p) {
    const v = new PolygonVertex(p.x, p.y) 
    v.edges = new Map();
    v.edges.set(this, other);
    v.edges.set(other, this);
    
    this.intersectionKeys.add(v.key);
    other.intersectionKeys.add(v.key);
    
    this.intersectsWith.set(other, v);
    other.intersectsWith.set(this, v);
  }

  /**
  * Given two arrays of edges with left/right vertices, find their intersections.
  * Mark the intersections using the _intersectsAt set property.
  * comparable to identifyWallIntersections method from WallsLayer Class 
  * @param {SimplePolygonEdge[]} edges1
  * @param {SimplePolygonEdge[]} edges2
  */
  static findIntersections(edges1, edges2, { intersecting_polygons = false } = {}) {
    edges1.sort((a, b) => compareXY(a.nw, b.nw));
    edges2.sort((a, b) => compareXY(a.nw, b.nw));
    
    
    
    // for each edge in poly1, iterate over poly2's edges.
    // can skip if poly2 edge is completely left of poly1 edge.
    // can skip to next poly1 edge if poly2 edge is completely right of poly1 edge
    const ln1 = edges1.length;
    for(let i = 0; i < ln1; i += 1) {
      const edge1 = edges1[i];
      
      edge1._identifyIntersections(edges2, {sort: false, intersecting_polygons });
    }
  }
}


export class SimplePolygon2 extends PIXI.Polygon {
  constructor(...points) {
    super(...points)
    
    // ensure polygon is closed
    this.close();
    
    this._edges = undefined;    
  } 

  
 /**
  * Getter to create a set of edges from polygon points
  * @type {Set[PolygonEdge]}
  */ 
  get edges() {
    return this._edges || (this._edges = this._constructEdgesArray());
  }
  
 /**
  * Helper to create an edges array from the points for this polygon.
  * @private
  */ 
  _constructEdgesArray() {
    const new_edges = [];
      
    const ptsIter = this.iteratePoints();
    let prevPt = ptsIter.next().value;
    let currPt;
    let prevEdge;
    while( (currPt = ptsIter.next().value) ) {
      const currEdge = new SimplePolygonEdge2(prevPt, currPt);
      if(prevEdge) { 
        prevEdge.next = currEdge; 
        currEdge.prev = prevEdge;
      }
      new_edges.push(currEdge);
      prevPt = currPt;
      prevEdge = currEdge;
    }
    prevEdge.next = new_edges[0];
    new_edges[0].prev = prevEdge;
    
    return new_edges;
  }
  
 /**
  * Factory function to change PIXI objects into a SimplePolygon
  * @param {PIXI.Polygon|PIXI.Circle|PIXI.Rectangle} poly
  * Options:
  * @param {number} density   For circle, how dense to make the polygon edges?
  * @return {SimplePolygon}
  */
  static fromPolygon(poly, { density = 60 } = {}) {
    if(poly instanceof PIXI.Circle) return poly.toPolygon({ density });
    if(poly instanceof PIXI.Rectangle) return poly.toPolygon();
  
    const s_poly = new this(poly.points);
    s_poly._isClockwise = poly._isClockwise;
    s_poly._isClosed = poly._isClosed;
    s_poly._isConvex = poly._isConvex;
    return s_poly;  
  } 
  
 /**
  * Test if this polygon could encompasses another
  * Only certain to encompass if you already know that the polygons do not intersect.
  * @param {PIXI.Polygon} other
  * @return {boolean} True if this polygon could possibly encompass the other.
  */
  encompassesPolygon(other) {
    const iter = other.iteratePoints();
    for(const pt of iter) {
      if(!this.contains(pt.x, pt.y)) return false;
    }
    return true;
  } 

  // -------------- STATIC METHODS FOR INTERSECT AND UNION ----------------------------
  // Static b/c usually want to combine two separate polygons and output a third.
  
 /**
  * Find the polygon representing the union of two polygons.
  * Polygons must be simple---they cannot intersect themselves.
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * @return {PIXI.Polygon}
  */
  static union(poly1, poly2) {
    poly1 = this.fromPolygon(poly1);
    poly2 = this.fromPolygon(poly2);
  
    // when tracing a polygon in the clockwise direction:
    // union: pick the counter-clockwise choice at intersections
    // intersect: pick the clockwise choice at intersections
    return this._combine(poly1, poly2, { clockwise: false });
  }

 /**
  * Find the polygon representing the intersection of two polygons.
  * Polygons must be simple---they cannot intersect themselves.
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * @return {PIXI.Polygon}
  */  
  static intersect(poly1, poly2) {
    poly1 = this.fromPolygon(poly1);
    poly2 = this.fromPolygon(poly2);
    const out = this._combine(poly1, poly2, { clockwise: true });
    
    // intersection of two convex polygons is convex
    // don't re-run convexity but add parameter if available
    if(poly1._isConvex && poly2._isConvex) { out._isConvex = true; }
    
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
  static _combine(poly1, poly2, { clockwise = true } = {}) {
    // Might be faster to start with the smaller polygon.
    // Because first we must locate the first intersection, so less of a walk
    // from the smaller polygon.
    
    let pts;
    if(poly1.points.length > poly2.points.length) {
      pts = this._tracePolygon(poly2, poly1, { clockwise });
    } else {
      pts = this._tracePolygon(poly1, poly2, { clockwise });
    }
  
    if(pts.length === 0) {
      // if no intersections, then either the polygons do not overlap (return null)
      // or one encompasses the other (return the one that encompasses the other)
      const union = !clockwise;
      if(poly1.encompassesPolygon(poly2)) return union ? poly1 : poly2; 
      if(poly2.encompassesPolygon(poly1)) return union ? poly2 : poly1; 
      return null;
    }
    
    const new_poly = new PIXI.Polygon(pts);
    
    // close the polygon
    new_poly.close();
    
    // algorithm always outputs a clockwise polygon
    new_poly._isClockwise = true;
    return new_poly; 
  } 
    
 /**
  * Trace around a polygon in the clockwise direction. At each intersection with
  * the second polygon, select either the clockwise or counterclockwise direction 
  * (based on the option). Return each vertex or intersection point encountered.
  *
  * Like with circle-polygon trace, use the other polygon as padding
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * Options: 
  * @param {boolean} clockwise  True if the trace should go clockwise at each 
  *                             intersection; false to go counterclockwise.
  * @return {number[]} Points array, in format [x0, y0, x1, y1, ...]
  * @private
  */ 
  static _tracePolygon(poly1, poly2, { clockwise = true } = {}) {
  
    SimplePolygonEdge2.findIntersections(poly1.edges, poly2.edges, {intersecting_polygons: true});
    
    // start at the first poly1 intersection that is not at an A vertex
    let curr_edge = poly1.edges.find(e => e.intersectionKeys.size &&
                                             !e.intersectionKeys.has(e.A.key));
                                             
    // if no intersections, can return
    if(!curr_edge) return [];
    
    // set up starting conditions
    const pts = [];
    const first_ix = curr_edge.orderedIntersections[0];
//     if(!first_ix.equals(curr_edge.B)) {
//       pts.push(first_ix.x, first_ix.y);
//     }
        
    // following ensures we don't get stuck in an infinite loop due to some error.
    const max_iterations = poly1.points.length / 2 + poly2.points.length / 2 + 1;
    let i;
    loop1:
    for(i = 0; i < max_iterations; i += 1) {
    
      // for a given current edge, we may have multiple intersections
      // test if we are at an intersection
      let num_ix = curr_edge.intersectionKeys.size;
      for(let x = 0; x < num_ix; x += 1) {
        // intersection does not count if it is an A vertex for the current edge
        if(x === 0 && curr_edge.intersectionKeys.has(curr_edge.A.key)) continue;
        
        const curr_ix = curr_edge.orderedIntersections[x];
        
        if(SimplePolygon2._checkForSwitch(curr_edge, x, clockwise)) {
          // jump to other polygon  
          curr_edge = curr_ix.edges.get(curr_edge); // Map is curr_edge --> other_edge          
      
          // figure out which intersection index we are on
          x = curr_edge.orderedIntersections.findIndex(e => e.key === curr_ix.key);
          if(x === -1) {
            console.error(`SimplePolygon|Intersection not found for key ${curr_ix.key}.`);     
          }  
          
          // update the maximum number of intersections now that we are on the other edge
          num_ix = curr_edge.intersectionKeys.size;
      
          // add the intersection point
          // note we are checking against the new current edge b/c that could be used 
          // below if no more intersections.
          if(!curr_ix.equals(curr_edge.B)) {
            pts.push(curr_ix.x, curr_ix.y);
          }

        } 
        
        // done when we get back to first intersection
        if(i && curr_ix.equals(first_ix)) break loop1;
        
        // if we are not switching polygons at this intersection, we don't need to add
        // this intersection to points (the intersection will line up with this edge)        
      }
    
      pts.push(curr_edge.B.x, curr_edge.B.y);
      curr_edge = curr_edge.next;
      // remember that A vertices === B vertices for connected polygons, so ignore A.
      
    } // end for loop
    
    
    if(i >= max_iterations) { 
      console.warn(`SimplePolygon|max iterations ${max_iterations} met.`);
    }
    
    return pts;
  }

  static _checkForSwitch(curr_edge, x, clockwise) {

    const curr_ix = curr_edge.orderedIntersections[x];
    
    const B1 = ( curr_ix.key === curr_edge.B.key ) ? curr_edge.next.B : curr_edge.B;

    const other_edge = curr_ix.edges.get(curr_edge);
    const B2 = curr_ix.equals(other_edge.B) ? 
               other_edge.next.B : other_edge.B;
  
    // determine direction from the intersection
    // is ix --> B1 --> B2 clockwise or counterclockwise?
    // orientation is positive if B2 is to the left (ccw) of x --> B1
    const orientation = foundry.utils.orient2dFast(curr_ix, B1, B2);
    return clockwise ? orientation < 0 : orientation > 0;
  }
}