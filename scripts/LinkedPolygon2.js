/* globals
PIXI,
foundry,
*/

'use strict';

import { log } from "./module.js";

/*
Linked Polygon used for finding simple polygon intersections and unions.
Given a PIXIjs polygon (array of coordinates), create a linked polygon. 
- Each edge vertex linked to another edge vertex so you can traverse the polygon
- in order clockwise
- Vertices are integer coordinates (pixels)

We need to get intersections between edges and add those as points, basically inserting
points into a given polygon.

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

class LinkedPolygonVertex {
  constructor(x, y) {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.key = (this.x << 16) ^ this.y;
    
   /**
    * The set of edges which connect to this vertex.
    */ 
    this.edges = new Set()
    
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
    return LinkedPolygonVertex.keyFromPoint(p) === this.key;
  }
  
}

class LinkedPolygonEdge {

 /**
  * If LinkedPolygonVertex is passed, it will be referenced as is.
  * @param a {Point|LinkedPolygonVertex}
  * @param b {Point|LinkedPolygonVertex}
  */
  constructor(a, b) {
    this.A = a instanceof LinkedPolygonVertex ? 
                a : LinkedPolygonVertex.fromPoint(a);
  
    this.B = b instanceof LinkedPolygonVertex ? 
                b : LinkedPolygonVertex.fromPoint(b);
                
    // add self to the set of edges at A and B
    this.A.edges.add(this);
    this.B.edges.add(this);            
    
    // following used in finding intersections
    this._nw = undefined;
    this._se = undefined;
    this._keys = undefined; 
    this._intersectsAt = new Set();
  }
  
 /**
  * Get the set of keys corresponding to this edge's vertices
  */
  get keys() {
    return this._keys || (this._keys = new Set([this.A.key, this.B.key]));
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
  * Given two arrays of edges with left/right vertices, find their intersections.
  * Mark the intersections using the _intersectsAt set property.
  * comparable to identifyWallIntersections method from WallsLayer Class 
  * @param {LinkedPolygonEdge[]} edges1
  * @param {LinkedPolygonEdge[]} edges2
  * @return {number} Number of intersections found
  */
  static findIntersections(edges1, edges2) {
    edges1.sort((a, b) => compareXY(a.nw, b.nw));
    edges2.sort((a, b) => compareXY(a.nw, b.nw));
    
    const ln1 = edges1.length;
    const ln2 = edges2.length;
    
    // for each edge in poly1, iterate over poly2's edges.
    // can skip if poly2 edge is completely left of poly1 edge.
    // can skip to next poly1 edge if poly2 edge is completely right of poly1 edge
    let num_intersections = 0;
    for(let i = 0; i < ln1; i += 1) {
      const edge1 = edges1[i];
    
      for(let j = 0; j < ln2; j += 1) {
        const edge2 = edges2[j];
        
         // if we have not yet reached the left end of this edge, we can skip
         if(edge2.se.x < edge1.nw.x) continue;
         
         // if we reach the right end of this edge, we can skip the rest
         if(edge2.nw.x > edge1.se.x) break;
         
         // ignore edges that share an endpoint but increment the intersection count
         if( edge1.keys.intersects(edge2.keys) ) {
           num_intersections += 1;
           continue;
         }
         
         // skip if no intersections
         if( !foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B) ) continue;
         
         // mark the intersection
         const x = foundry.utils.lineLineIntersection(edge1.A, edge1.B, edge2.A, edge2.B);
         if(x) {
           num_intersections += 1;
           edge1._intersectsAt.add(x);
           edge2._intersectsAt.add(x);
         }       
      }
    }
    return num_intersections;
  }
  
 /**
  * Split edge at point.
  * Disconnects this from the A and B vertices.
  * Creates two new edges:
  * A <--> point
  * point <--> B
  * @param {Point} p
  * @param {Array[2]{LinkedPolygonEdge}}
  */
  splitAt(p) {
    // disconnect self from A and B
    this.A.edges.delete(this);
    this.B.edges.delete(this);
  
    const a_edge = new this.constructor(this.A, p);
    const b_edge = new this.constructor(a_edge.B, this.B);
    
    // TO-DO: Should nw/se be transferred to new edges?
    
    return [a_edge, b_edge];
  }
  

}


export class LinkedPolygon2 extends PIXI.Polygon {
  constructor(...points) {
    super(...points)
    
    this._points = this.points;
    this._resetPoints = false; // flag if we should re-create points from edges
    
    // ensure points are closed
    const ln = this.points.length;
    if(this.points[0] !== this.points[ln - 2] || this.points[1] !== this.points[ln - 1]) {
      log(`LinkedPolygon2 expects a closed set of points.`, this.points);
      this.points.push(this.points[0], this.points[1]);
    }
    
    if(!this.isClockwise()) {
      this.reverse();
    }
    
    this._constructLinkedEdgesVertices(); 
  } 
  
 /** 
  * Helper to build the linked edges and vertices
  * @private
  */
  _constructLinkedEdgesVertices() {
    this.edges = new Set();
    this.vertices = new Map(); // organize by Vertex keys

    // Note: Initially, vertices will be in order. That may change when splitting 
    // edges to do the polygon intersection. Likely not worth re-inserting the entire
    // map set, so walking a polygon done by linked vertices/edges, not by the Map order.
    
    // construct edges and vertices   
    // A will be ccw, B cw
    const ptsIter = this.iteratePoints(false);
    
    // cache the first vertex and mark it
    let prev_pt = ptsIter.next().value;
    this.firstVertex = LinkedPolygonVertex.fromPoint(prev_pt);
    this.vertices.set(this.firstVertex.key, this.firstVertex);
    this.firstVertex.isFirst = true;
    let prev_v = this.firstVertex;
    
    for(let pt of ptsIter) {
      const curr_v = LinkedPolygonVertex.fromPoint(pt);
      this.vertices.set(curr_v.key, curr_v);
      const edge = new LinkedPolygonEdge(prev_v, curr_v);
      prev_v.cwEdge = edge;
      curr_v.ccwEdge = edge;
      
      this.edges.add(edge);
      
      prev_v = curr_v;
    }
    // link to beginning
    const edge = new LinkedPolygonEdge(prev_v, this.firstVertex);
    prev_v.cwEdge = edge;
    this.firstVertex.ccwEdge = edge;
    this.edges.add(edge);       
  } 
  
 /**
  * Helper to re-build the points set by iterating through the vertices map.
  * @private
  */
  _rebuildPoints() {
    this._points = [];
    const vIter = this.iterateVertices()
    for(const v of vIter) {
      this._points.push(v.x, v.y);
    }
    // close the points
    this._points.push(this._points[0], this._points[1]);
  }
    
 /**
  * Getter/setter for points so we can ensure they match edges.
  * Not typically required if just finding intersects or unions, but just in case
  * someone manipulates the points. 
  * @type {number[]}
  */
  get points() {
    if(this._resetPoints) {
      this._rebuildPoints();
    }
    return this._points;
  }
  
  set points(value) {
    this._points = value;
    this._constructLinkedEdgesVertices();
  }
 
 /**
  * Helper to check if this polygon has a given vertex.
  * @param {LinkedPolygonVertex|Point} v
  * @return {boolean} True if this polygon has this vertex.
  */
  hasVertex(v) {
    const key = LinkedPolygonVertex.keyFromPoint(v);
    return this.vertices.has(key);
  }
 
 /**
  * Given an edge in this Polygon, split it at the given point.
  * If point is already an edge vertex, do nothing
  * Otherwise, split edge into two and relink accordingly.
  * @param {LinkedPolygonEdge} edge
  * @param {Point} point
  * @return {LinkedPolygonEdge|undefined} The newly created edge, if any.
  */
  splitAtEdge(edge, p) {
    if(!this.edges.has(edge)) {
      console.error(`LinkedPolygon2 splitAtEdge: edge not found.`, edge);
      return;
    }
    
    const p_key = LinkedPolygonVertex.keyFromPoint(p);
    if(edge.keys.has(p_key)) return;
    
    // from this point on, we are committed to splitting.
    // mark that the points are now out-of-date
    this._resetPoints = true;
    
    const [a_edge, b_edge] = edge.splitAt(p);
    this.edges.delete(edge);
    
    this.edges.add(a_edge);
    this.edges.add(b_edge);
    
    // edges always split A|p|B
    // A and B will be same as the old A|B edge
    // p is a new vertex at a_edge.B and b_edge.A.
    
    this.vertices.set(a_edge.B.key, a_edge.B);
    
    // need to fix linking for the new edges; removing edge entirely
    // was ccwEdge (prevEdge) -- A -- cwEdge / ccwEdge (edge) -- B -- cwEdge (nextEdge)
    // now ccwEdge (prevEdge) -- A -- cwEdge / ccwEdge (a_edge) -- p -- cwEdge / ccwEdge (b_edge) -- B -- cwEdge (nextEdge)
    
    // link previous and next edges to a_edge and b_edge, respectively
    const prevEdge = edge.A.ccwEdge;
    const nextEdge = edge.B.cwEdge;
    prevEdge.B.cwEdge = a_edge;
    nextEdge.A.ccwEdge = b_edge;
    
    // link a_edge and b_edge to each other (and themselves)
    a_edge.B.cwEdge = b_edge;
    a_edge.B.ccwEdge = a_edge;
    
    b_edge.A.cwEdge = b_edge;
    b_edge.A.ccwEdge = a_edge;
    
   
      
    return [a_edge, b_edge];
  }
  
 /**
  * Construct a linked polygon from a PIXI.Polygon
  * @param {PIXI.Polygon} poly
  * @return {LinkedPolygon}
  */
  static fromPolygon(poly) {
    return new this(poly.points);
  }
    
 /**
  * Iterate over the vertices of this polygon.
  * First vertex returned will match key.
  * @param {integer} key        Key of the starting vertex; default first vertex
  * @param {boolean} clockwise  True to iterate clockwise; false to iterate ccw.
  * @return {Generators{LinkedPolygonVertex}}
  */
  * iterateVertices({ key = this.firstVertex.key, clockwise = true } = {}) {
    const e_dir = clockwise ? "cwEdge" : "ccwEdge";
    const v_dir = clockwise ? "B" : "A";
    
    const starting_v = this.vertices.get(key);
    if(!starting_v) {
      console.error(`iterateVertices given key ${key} with no matching vertex.`);
      return;
    }
    // always return the starting vertex
    yield starting_v;
    let curr_e = starting_v[e_dir];
    while(!curr_e[v_dir].equals(starting_v)) {
      yield curr_e[v_dir];
      curr_e = curr_e[v_dir][e_dir];
    }
  }
  
 /**
  * Iterate over the edges of this polygon.
  * First edge returned will be the starting_edge
  * @param {LinkedPolygonEdge} starting_edge    Starting edge; default first cw edge.
  * @param {boolean} clockwise                  True to iterate clockwise; false to iterate ccw. 
  * @return {Generator{LinkedPolygonEdge}}
  */
  * iterateEdges({ starting_edge = this.firstVertex.cwEdge, clockwise = true } = {}) {
    // use iterateVertices and get the directional edge for each.
    // thus, if cw, pass the "A" vertex key to iterateVertices to get the cw edge.
    const starting_v = clockwise ? "A" : "B"
    const e_dir = clockwise ? "cwEdge" : "ccwEdge";
    
    const vIter = this.iterateVertices({ key: starting_edge[starting_v].key, clockwise });
    for(let vertex of vIter) {
       yield vertex[e_dir];
    }
  }
  
 /**
  * For a given edge, process its intersecting points, if any, by splitting the edge.
  * @param {LinkedPolygonEdge} edge
  * @private
  */
  _processEdgeIntersections(edge) {
    if(!this.edges.has(edge)) {
      console.error(`LinkedPolygon2 _processEdgeIntersections: edge not found.`, edge);
      return;
    }
  
    const sz = edge._intersectsAt.size;
    if(sz === 0) return;
    
    const xs = [...edge._intersectsAt];
    edge._intersectsAt.clear();
    if(sz === 1) {
      this.splitAtEdge(edge, xs[0]);
      return;
    }
    
    // order the points from A to B, so when splitting, it will go
    // A|p1|p2|...|B
    // That way, new_edge will be p1|B, then p2|B, etc.
    
    xs.sort(compareXY);
    
    // if B is nw, reverse the sort
    if(edge.B === edge.nw) { xs.reverse(); }
    
    xs.forEach(x => {
      const new_edges = this.splitAtEdge(edge, x);
      
      // if new_edge is undefined, no split likely b/c we are at a vertex already.
      // otherwise, splitAtEdge returns [A|p, p|B] edges.
      // we want p|B edge to process any additional intersections going forward.
      if(new_edges) edge = new_edges[1]; 
    });
  }
  
 /**
  * Test if this polygon encompasses another
  * @param {LinkedPolygon} other_poly
  */
  encompassesPolygon(other_poly) {
    const iter = other_poly.iteratePoints();
    for(const pt of iter) {
      if(!this.contains(pt.x, pt.y)) return false;
    }
    return true;
  } 
  
 /**
  * Given two sets of PIXI.Polygons,
  * construct LinkedPolygons and split edges for each at intersections
  * meaning: construct new vertex at intersection, split edge, update points
  * two types of intersections: edge | edge and edge | vertex
  * (vertex | vertex) can be safely ignored b/c vertices are integer coordinates
  * and so already equal.
  * @param {LinkedPolygon} poly1
  * @param {LinkedPolygon} poly2
  * @return {number} Number of intersections found. 
  */
  static splitAtIntersections(poly1, poly2) {    
    // label each edge with all its intersection points
    // here, poly1 edges can only intersect with poly2 edges and vice-versa
    const num_intersections = LinkedPolygonEdge.findIntersections([...poly1.edges], [...poly2.edges]);
    
    
    // for each polygon, go through its edges and if intersecting points found,
    // split the edge. If more than one intersection on an edge, make sure to split
    // in order, so that the edge is divided correctly into its multiple parts.
    if(num_intersections) {
      poly1.edges.forEach(e => { poly1._processEdgeIntersections(e); })
      poly2.edges.forEach(e => { poly2._processEdgeIntersections(e); })
    }
    
    return num_intersections;
  }

  // find union and intersection by walking along one polygon, always choosing the 
  // outside direction. So if walking clockwise and at an intersection vertex,
  // select the ccw direction.
  /*
   * Walk from vertex:
   * 1. start at vertex.
   * 2. walk each polygon from the intersection.
   * 3. always pick CW at new intersections
   * 4. once your reach the beginning, you have a polygon
   * 
   * categorize each polygon as either intersect, p1 only, p2 only, or union
   * intersect: point contained by the polygon is contained by p1 and p2
   * union: walking clockwise, you pick the counterclockwise edge each time
   * intersection: walking clockwise, you pick the clockwise edge each time
   */
  static union(poly1, poly2, { split = true, num_intersections = 0 } = {}) {
    if(!(poly1 instanceof LinkedPolygon2)) poly1 = LinkedPolygon2.fromPolygon(poly1);
    if(!(poly2 instanceof LinkedPolygon2)) poly2 = LinkedPolygon2.fromPolygon(poly2);
  
    return this._combine(poly1, poly2, { split, num_intersections, union: true });
  } 
  
  static intersect(poly1, poly2, { split = true, num_intersections = 0 } = {}) {
    if(!(poly1 instanceof LinkedPolygon2)) poly1 = LinkedPolygon2.fromPolygon(poly1);
    if(!(poly2 instanceof LinkedPolygon2)) poly2 = LinkedPolygon2.fromPolygon(poly2);

    return this._combine(poly1, poly2, { split, num_intersections, union: false });
  }  
   
  static _combine(poly1, poly2, { union = true, split = true, num_intersections = 0 } = {}) {
    if(split) {
      num_intersections = this.splitAtIntersections(poly1, poly2);
      log(`LinkedPolygon2._combine ${num_intersections} intersections found.`);
    }
    
    if(!num_intersections) {
      // if no intersections, then either the polygons do not overlap (return null)
      // or one encompasses the other (return the one that encompasses the other)
      if(poly1.encompassesPolygon(poly2)) return union ? poly1 : poly2;
      if(poly2.encompassesPolygon(poly1)) return union ? poly2 : poly1;
      return null;
    }

    // starting_vertex is the first vertex shared by both polygons     
    const starting_vertex = poly1._firstIntersectingVertex(poly2);
    if(!starting_vertex) {
      console.warn(`LinkedPolygon2._combine: No starting vertex found.`);
      return null;
    }
    
    // for union, walk clockwise and turn counterclockwise at each intersection
    // for intersect, walk clockwise and turn clockwise at each intersection
    const pts = LinkedPolygon2.tracePolygon(starting_vertex, poly1, poly2, { clockwise: !union });
    return new this(pts);
    //return pts;
  } 
      
  static tracePolygon(starting_vertex, poly1, poly2, { clockwise = true, max_iterations = 1e06 } = {}) {
    const pts = []; // to track the points found as we trace the polygon
    let current_poly = poly1; // which polygon are we currently tracing?
    let other_poly = poly2;
    
    let vIter = current_poly.iterateVertices(starting_vertex);
    let finished = false;
    let i = 0;
    while(!finished) {
      const v = vIter.next().value;
      
      if(!v) break;
      if(i > max_iterations) break; // for debugging
      
      
      
      log(`LinkedPolygon2.tracePolygon: point ${v.x}, ${v.y} added.`);
      pts.push(v.x, v.y);
      
      // test after the pts.push b/c we want a closed polygon
      if(i && v.equals(starting_vertex)) break;
      i += 1;
      
      
      if(other_poly.hasVertex(v)) {
        // from this vertex, we have clockwise edges in two directions. 
        // v --> poly1 edge --> new v1
        // v --> poly2 edge --> new v2
        // v --> v2 --> v1 oriented clockwise and clockwise option is true: use v1
        const v_curr = SecondValue(current_poly.iterateVertices(v));
        const v_other = SecondValue(other_poly.iterateVertices(v));
        
        // orientation is positive if v_other is to the left (ccw) of v --> v_curr
        const orientation = foundry.utils.orient2dFast(v, v_curr, v_other);
        if(orientation > 0 && !clockwise || 
           orientation < 0 && clockwise) {
          // jump to the other polygon
          vIter = other_poly.iterateVertices(v_other);
          const tmp = current_poly;
          current_poly = other_poly;
          other_poly = tmp;
        }
      } // otherwise, can go to the next v
    }  
    if(i > max_iterations) { console.warn(`LinkedPolygon2 tracePolygon: hit max iterations ${i}`); } 
    
    return pts; 
  } 
  
 /**
  * Find the first intersecting vertex between this and another polygon.
  * In order walking around this polygon.
  * @param {LinkedPolygon} other_poly
  * @return {LinkedPolygonVertex|null}
  * @private
  */
  _firstIntersectingVertex(other_poly) {
    const vIter = this.iterateVertices();
    for(const v of vIter) {
      if(other_poly.hasVertex(v)) return v;
    }
    return null;
  }
  
}

// utility functions

/**
 * Get the second value from an iterator
 * @param {Object} iter  iterator
 * @return {Object}
 */
function SecondValue(iter) { 
  iter.next();
  return iter.next().value;
}

