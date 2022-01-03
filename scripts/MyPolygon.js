/* globals
CONST,
foundry,
PolygonVertex
*/

'use strict';

//import { log } from "./module.js";

import { compareXY } from "./utilities.js";


export class MyPolygonEdge {
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
  * @param {MyPolygonEdge[]} edges   Array of edges
  * Options:
  * @param {boolean} sort   Does the edge array need to be sorted? If false, edges must
  *                         be sorted beforehand.
  */
  identifyIntersections(edges, { sort = true } = {}) {
    if(sort) { edges.sort((a, b) => compareXY(a.nw, b.nw)); }
      
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

