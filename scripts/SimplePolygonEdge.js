/* globals
foundry,
PolygonEdge,
CONST,
Wall
*/

'use strict';

import { compareXY } from "./utilities.js";

/*
Version of PolygonEdge that can handle temporary walls.

For ClockwiseSweep, we want the ability to add temporary walls to the sweep algorithm.
To do so, we need to add (temporarily) intersections between the temporary walls and
walls on the canvas. Adding the intersections to wall.intersectsWith would be easy, but
removing them after the sweep, not so much.

Thus, we have three options to combine the temp edges with existing walls for the
intersectsWith map:
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

export class SimplePolygonEdge extends PolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    super(a, b, type, wall);

    // Track wall ids if this edge corresponds to existing wall
    // This replaces wallEdgeMap in ClockwiseSweep.
    this._id = undefined;

    // following used in finding intersections
    this._nw = undefined;
    this._se = undefined;
    this._wallKeys = undefined;

    this.intersectsWith = new Map();  // Map just as with wall.intersectsWith
  }

 /**
  * Get the id for this edge (needed for ClockwiseSweep)
  * @type {string}
  */
  get id() {
    return this._id || (this._id = this.wall?.id || foundry.utils.randomID());
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


  // Comparable to Wall class methods
  get vertices() {
    return { a: this.A, b: this.B };
  }

  get wallKeys() {
    return this._wallKeys || (this._wallKeys = new Set([ this.A.key, this.B.key ]));
  }

}

 /**
  * Record the intersection points between this edge and another, if any.
  */
Object.defineProperty(SimplePolygonEdge.prototype, "_identifyIntersectionsWith", {
  value: Wall.prototype._identifyIntersectionsWith,
  writable: true,
  configurable: true
});

