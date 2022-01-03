/* globals
PIXI,
foundry,
*/

'use strict';

//import { log } from "./module.js";

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

export class SimplePolygonVertex {
  constructor(x, y) {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.key = (this.x << 16) ^ this.y;    
  }
  
 /**
  * Helper to construct a Vertex given a point.
  * @param {Point} point
  * @return {LinkedPolygonVertex}
  */
  static fromPoint(point) {
    return new this(point.x, point.y);
  }
  
 /**
  * Calculate key
  * @param {LinkedPolygonVertex|Point} p  Point or vertex to calculate the key.
  * @return {number} Integer key for the coordinates or the existing key, if any.
  */
  static keyFromPoint(p) {
    return p?.key || (Math.round(p.x) << 16) ^ Math.round(p.y);
  } 
  
 /**
  * Does this vertex share the same coordinates as another?
  * @param {LinkedPolygonVertex|Point} p  Point or vertex
  * @return {boolean} True if they share the same integer coordinates.
  */
  equals(p) {
    return this.keyFromPoint(p) === this.key;
  }
  
}

export class SimplePolygonEdge {

 /**
  * If LinkedPolygonVertex is passed, it will be referenced as is.
  * @param a {Point|LinkedPolygonVertex}
  * @param b {Point|LinkedPolygonVertex}
  */
  constructor(a, b) {
    this.A = SimplePolygonVertex.fromPoint(a) 
    this.B = SimplePolygonVertex.fromPoint(b)
                   
    // following used in finding intersections
    this._nw = undefined;
    this._se = undefined;
    this._edgeKeys = undefined; 
    this.intersectsWith = new Map();
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
  * @type {LinkedPolygonVertex}
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
  * @type {LinkedPolygonVertex}
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
  * @param {MyPolygonEdge2[]} edges   Must be sorted.
  */
  _identifyIntersections(edges) {
    //edges.sort((a, b) => compareXY(a.nw, b.nw));
      
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
  * @param {SimplePolygonEdge} other   The other edge.
  * @private
  */
  _identifyIntersectionsWith(other) {
    // if ( this === other ) return;
    
    // if edges share 1 or 2 endpoints, include their endpoints as intersections
    if ( this.edgeKeys.intersects(other.edgeKeys) ) {
      if(this.edgeKeys.has(other.A.key)) { this._addIntersectionPoint(other, other.A); }
      if(this.edgeKeys.has(other.B.key)) { this._addIntersectionPoint(other, other.B); }
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
  * Helper to add an intersection point both this and other intersect sets.
  * @param {SimplePolygonEdge} other   The other edge. 
  * @param {Point} v                   Intersection to add. Must have {x, y} coordinates.
  * @private
  */
  _addIntersectionPoint(other, p) {
    const v = SimplePolygonVertex.fromPoint(p)
    v.edges = new Map();
    v.edges.set(this, other);
    v.edges.set(other, this);
    
    this.intersectsWith.set(v.key, v);
    other.intersectsWith.set(v.key, v);
  }

  /**
  * Given two arrays of edges with left/right vertices, find their intersections.
  * Mark the intersections using the _intersectsAt set property.
  * comparable to identifyWallIntersections method from WallsLayer Class 
  * @param {LinkedPolygonEdge[]} edges1
  * @param {LinkedPolygonEdge[]} edges2
  */
  static findIntersections(edges1, edges2) {
    edges1.sort((a, b) => compareXY(a.nw, b.nw));
    edges2.sort((a, b) => compareXY(a.nw, b.nw));
    
    const ln1 = edges1.length;
    const ln2 = edges2.length;
    
    // for each edge in poly1, iterate over poly2's edges.
    // can skip if poly2 edge is completely left of poly1 edge.
    // can skip to next poly1 edge if poly2 edge is completely right of poly1 edge
    for(let i = 0; i < ln1; i += 1) {
      const edge1 = edges1[i];
    
      for(let j = 0; j < ln2; j += 1) {
        const edge2 = edges2[j];
        
         // if we have not yet reached the left end of this edge, we can skip
         if(edge2.se.x < edge1.nw.x) continue;
         
         // if we reach the right end of this edge, we can skip the rest
         if(edge2.nw.x > edge1.se.x) break;
                   
        // if edges share 1 or 2 endpoints, include their endpoints as intersections
        if ( edge1.edgeKeys.intersects(edge2.edgeKeys) ) {
          if(edge1.edgeKeys.has(edge2.A.key)) { 
            edge1._addIntersectionPoint(edge2, edge2.A); 
            edge2._addIntersectionPoint(edge1, edge2.A); 
          }
          if(edge1.edgeKeys.has(edge2.B.key)) { 
            edge1._addIntersectionPoint(edge2, edge2.B); 
            edge2._addIntersectionPoint(edge1, edge2.B); 
          }
          
          
          
          return;
        }
         
         // skip if no intersections
         if( !foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B) ) continue;
         
         // mark the intersection
         const x = foundry.utils.lineLineIntersection(edge1.A, edge1.B, edge2.A, edge2.B);
         if(x) {
//            edge1.intersectsWith.add(x);
//            edge2.intersectsWith.add(x);
           
           edge1._addIntersectionPoint(edge2, x);
           edge2._addIntersectionPoint(edge1, x);
         }       
      }
    }
  } 

}


export class SimplePolygon extends PIXI.Polygon {
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
    if(!this._edges) { this._constructEdgesArray(); }
    return this._edges;
  }
  
 /**
  * Helper to create an edges array from the points for this polygon.
  * @private
  */ 
  _constructEdgesArray() {
    this._edges = [];
      
    const ptsIter = this.iteratePoints();
    let prevPt = ptsIter.next().value;
    let currPt;
    let prevEdge;
    while( (currPt = ptsIter.next().value) ) {
      const currEdge = new SimplePolygonEdge(prevPt, currPt);
      if(prevEdge) { 
        prevEdge.next = currEdge; 
        currEdge.prev = prevEdge;
      }
      this._edges.push(currEdge);
      prevPt = currPt;
      prevEdge = currEdge;
    }
    prevEdge.next = this._edges[0];
    this._edges[0].prev = prevEdge;
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
  * Test if this polygon encompasses another
  * @param {PIXI.Polygon} other_poly
  */
  encompassesPolygon(other_poly) {
    const iter = other_poly.iteratePoints();
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
    
    // algorithm always outputs a clockwise polygon
    new_poly._isClockwise = true;
    return new_poly; 
  } 
    
 /**
  * Trace around a polygon in the clockwise direction. At each intersection with
  * the second polygon, select either the clockwise or counterclockwise direction 
  * (based on the option). Return each vertex or intersection point encountered.
  * @param {PIXI.Polygon} poly1
  * @param {PIXI.Polygon} poly2
  * Options: 
  * @param {boolean} clockwise  True if the trace should go clockwise at each 
  *                             intersection; false to go counterclockwise.
  * @return {number[]} Points array, in format [x0, y0, x1, y1, ...]
  * @private
  */ 
  static _tracePolygon(poly1, poly2, { clockwise = true }) {
  
    SimplePolygonEdge.findIntersections(poly1.edges, poly2.edges);
    const first_edge = poly1.edges.find(e => e.intersectionKeys.size);
    if(!first_edge) return [];
    
    const pts = [];
            
    let curr_edge = first_edge;
        
    let next_x_i = 1;
    let curr_pt = first_edge.orderedIntersections[0];
    const first_vertex = curr_pt;
    const first_vertex_key = first_vertex.key;
    
    const max_iterations = poly1.points.length / 2 + poly2.points.length / 2 + 1;
    let i;
    for(i = 0; i < max_iterations; i += 1) {
    //for(i = 0; i < 6; i += 1) {
      // each iteration should add one intersection point to the points array
      // each iteration may also add vertices A and B
//       drawVertex(curr_pt)
//       i += 1
      
      if(curr_pt.key === first_vertex_key && i > 0) break;
      
      pts.push(curr_pt.x, curr_pt.y);
      
      // Process intersections
      if(next_x_i) {
        // we are at an intersection. Determine if we need to move to other polygon
        
        // tricky part: if intersection is at B, we need the next edge's B vertex
        const B1 = ( curr_pt.key === curr_edge.B.key ) ? curr_edge.next.B : curr_edge.B;
        
        const other_edge = curr_pt.edges.get(curr_edge);
        const B2 = ( curr_pt.key === other_edge.B.key ) ? 
                   other_edge.next.B : other_edge.B;
        
        // determine direction from the intersection
        // is ix --> B1 --> B2 clockwise or counterclockwise?
        // orientation is positive if B2 is to the left (ccw) of x --> B1
        const orientation = foundry.utils.orient2dFast(curr_pt, B1, B2);
        if(orientation > 0 && !clockwise || 
           orientation < 0 && clockwise) {
          // jump to other polygon  
          curr_edge = curr_pt.edges.get(curr_edge); // Map is curr_edge --> other_edge          
          
          // figure out which intersection index we are on
          next_x_i = curr_edge.orderedIntersections.findIndex(x => x.key === curr_pt.key) + 1;
          if(next_x_i === -1) {
            console.error(`SimplePolygon|Intersection not found for key ${curr_pt.key}.`);     
          }  
        }
        
        // from an intersection, the next point is either B or another intersection
        const xs = curr_edge.orderedIntersections;
        if(next_x_i < xs.length) {
          // get the next intersection
          curr_pt = xs[next_x_i];
          next_x_i += 1;
          
//           console.log("Process next intersection")
          continue; // process that next intersection point   
        }
      } 
      
      // no more intersections
      // add edge B unless it was already dealt with as an intersection
      // or already added as curr_pt
      if(curr_pt.key !== curr_edge.B.key && 
         !curr_edge.intersectsWith.has(curr_edge.B.key)) {
        pts.push(curr_edge.B.x, curr_edge.B.y);
      }
            
      // go to next edge
      curr_edge = curr_edge.next;
                  
      // at next edge, A is the previous edge's B. 
      // so don't add A, skip if it is an intersection
      if(curr_edge.intersectsWith.size > 0) {
        // this new edge has intersections. Get the first one.
        
        // check if A is an intersection
        // if it is, skip the first intersection
        if(curr_edge.intersectsWith.has(curr_edge.A.key)) { 
          if(curr_edge.intersectsWith.size > 1) {
            curr_pt = curr_edge.orderedIntersections[1];
            next_x_i = 2;
          } else {
            next_x_i = 0;
            curr_pt = curr_edge.B;
          }
        } else {
          curr_pt = curr_edge.orderedIntersections[0];
          next_x_i = 1;
        }
      } else {
        next_x_i = 0;
        curr_pt = curr_edge.B; 
      }
    } // end for loop
    
    if(i >= max_iterations) { 
      console.warn(`SimplePolygon|max iterations ${max_iterations} met.`);
    }
    
    // add the first vertex again to close the polygon
    pts.push(first_vertex.x, first_vertex.y)
    
    return pts;
  
  }
}