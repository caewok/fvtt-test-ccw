/* globals foundry */
'use strict';

import { arraySwap, 
         almostEqual, 
         COLORS,
         compareXY,
         compareXY_A,
         compareYX,
         MapArray } from "./util.js";
import { CCWSightRay } from "./class_CCWSightRay.js";
import { CCWSweepWall }       from "./class_CCWSweepWall.js";
import { CCWSweepPoint }      from "./class_CCWSweepPoint.js";
import { BinarySearchTree } from "./class_BinarySearchTree.js";


/**
 * Class to hold static methods implementing different algorithms 
 * to identify intersections for a set of walls.
 */
export class IdentifyIntersections {

  // -------------- STATIC SWEEP ALGORITHM METHODS AND HELPERS ----------------
  
 /**
  * Helper function to build 4 walls from the overlap (intersection) of two walls.
  * Each intersection is just an object identifying the two walls 
  * and the intersection point.
  * Convert overlaps to distinct wall sections
  *  •               •
  *   \               \
  *    \               \
  * •---\----•   ==> •--•----•  
  *      \               \
  *       •               •
  * 
  * @param {{x, y}[]}           intersections    Array of intersections for that wall
  * @param {CCWSweepWall}	wall		Must be left-right sweep wall (see createLeftRightSweepWalls)
  * @return {CCWSweepWall[]}
  */
  static buildWallsFromIntersections(intersections, wall) {
    if(intersections.length === 0) return [wall];
    intersections.sort(compareXY);

    const finished_walls = [];
    let remainder = wall;
    intersections.forEach(i_point => {
      // check that we are not repeating points
      if(pointsAlmostEqual(remainder.A, i_point) || 
         pointsAlmostEqual(i_point, wall.B)) { return; }
      const new_w = CCWSweepWall.createFromPoints(remainder.A, i_point, wall); 
      finished_walls.push(new_w);
      remainder = CCWSweepWall.createFromPoints(i_point, remainder.B, wall);
    });
    finished_walls.push(remainder)
    
    return finished_walls;
  }
  
 /**
  * Determine if walls intersect one another.
  * Brute force version. See BruteForceIntersections class.
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {CCWSweepWall[]}
  */
  static processWallIntersectionsBruteForce(walls) { 
    const finished_walls = [];
    const brute = new BruteForceIntersections(walls);
    while(brute.incomplete) {
      const w = brute.step();
      if(brute.intersections_map.has(w.id)) {
        const intersections = brute.intersections_map.get(w.id);
        const new_ws = IdentifyIntersections.buildWallsFromIntersections(intersections, w);
        finished_walls.push(...new_ws);
      } else {
        // wall has no intersections; need not be split; just add to array
        finished_walls.push(w);
      }
    }
    
    return finished_walls;
  }
  
 /**
  * Determine if walls intersect one another.
  * Comparable to and better than brute force version, but still relatively simple.
  * See SimpleSweepIntersections class.
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {CCWSweepWall[]}
  */
  static processWallIntersectionsSimpleSweep(walls) {
    const finished_walls = [];
    const sweep = new SimpleSweepIntersections(walls);
    while(sweep.incomplete) {
      const w = sweep.step();
      if(sweep.intersections_map.has(w.id)) {
        const intersections = sweep.intersections_map.get(w.id);
        const new_ws = IdentifyIntersections.buildWallsFromIntersections(intersections, w);
        finished_walls.push(...new_ws);
      } else {
        // wall has no intersections; need not be split; just add to array
        finished_walls.push(w);
      }
    }
     
    return finished_walls;    
  }
  
 /**
  * Determine wall intersections using a Bentley Ottoman sweep algorithm.
  * See BentleyOttomanSweep class for details.
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {CCWSweepWall[]}
  */
  static processWallIntersectionsBentleyOttomanSweep(walls) {
    const finished_walls = [];
    const remainders = new Map(); // Track remaining wall pieces by wall id
    const sweeper = new BentleyOttomanSweepIntersections(walls);
    
    // we are moving left-to-right, so we can chop up walls as we go
    while(sweeper.incomplete) {
      const e = sweeper.step();
      //e.draw()
      const i_point = e.left; // could just use e but this saves a few calcs.
      
      switch(e.event) {
        case "left":
          // add to the store
          remainders.set(e.id, CCWSweepWall.createFromPoints(e.left, 
                                  e.right, e.base_wall));
        break;
        
        case "right":
          // done with this wall, so put the remainder in the finished set
          finished_walls.push(remainders.get(e.id));
        break;
            
        case "intersection":
          // for each wall in the intersection, cut the remainder at the intersection
          // here, e.left is the intersection point
          // remainders are created above as A: left, B: right
          // count the intersection unless it is an endpoint of that wall
          
          e.walls.forEach((w, id) => {
            const curr_remainder = remainders.get(id);
            
            // check that we are not repeating endpoints
            if(pointsAlmostEqual(curr_remainder.A, i_point) || 
               pointsAlmostEqual(i_point, curr_remainder.B)) { return; }
            
            const new_w = CCWSweepWall.createFromPoints(curr_remainder.A, 
                                                        i_point, w); 
            const new_remainder = CCWSweepWall.createFromPoints(i_point, 
                                                                curr_remainder.B, w); 
            finished_walls.push(new_w);
            remainders.set(id, new_remainder);
          });  
        break;
      }
    }
    return finished_walls;
  }
}




 /**
  * Brute-force algorithm to identify intersections.
  * Brute force version that should run in O(n^2)
  * For each pair of walls, check for an intersection. If intersection, add to BST.
  * Using BST for the search feature, so we can find existing intersections.
  * Search is using x, then y if x is equal for two intersections.
  * The result is a set of intersections, each storing 2+ walls.
  */
export class BruteForceIntersections {

 /**
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  */
  constructor(walls) {
    this.walls = BruteForceIntersections.createLeftRightSweepWalls(walls);
    
    // Store intersections keyed by each wall id.
    // Each entry is an array of intersections for that wall.
    this.intersections_map = new MapArray();
    
    this.i = 0; // what wall are we on? Used for step().
  }
  
  // --------------- GETTERS / SETTERS --------------------- //
 /**
  * Sweep not yet done.
  * See run() for an example loop.
  * @type {boolean}
  */
  get incomplete() { return this.i < this.walls.length; }

  /**
   * Run the entire algorithm and return the intersections
   * @return {Map<id, {x, y}[]>}
   */
   run() {
     while(this.incomplete) { this.step(); }
     return this.intersections_map;
   } 
  
  /**
   * Run a single step of the algorithm. Here, processing a single wall.
   * @return {CCWSweepWall} For convenience, return the wall just processed.
   */
   step() {
     const w0 = this.walls[this.i];
     
     this.walls.forEach(w1 => {
       if(w0.intersects(w1)) {
         const i_point = w0.intersectSegment(w1.coords);
         
         // count the intersection unless it is an endpoint of that wall
         if(!(pointsAlmostEqual(w0.A, i_point) || 
              pointsAlmostEqual(w0.B, i_point))) {
            this.intersections_map.push(w0.id, { x: i_point.x, y: i_point.y });
         }
          
         // same for the second wall
         if(!(pointsAlmostEqual(w1.A, i_point) || 
              pointsAlmostEqual(w1.B, i_point))) {
            this.intersections_map.push(w1.id, { x: i_point.x, y: i_point.y })  
         } 
       }
     });
     this.i += 1;
     return w0;
   }
}




 /**
  * Determine if walls intersect one another.
  * Comparable to and better than brute force version, but still relatively simple.
  * Sweep from left to right for a given wall.
  * At each left endpoint for the wall, test all walls to the right until
  * the right wall's left endpoint is to the left of this wall's right endpoint.
  * (i.e, there is no way the two walls share x coords)
  * Unlike brute force, must sort the walls.
  * Worst case still O(n^2) but in practice will skip many irrelevant walls
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {Wall[]}  
  */
export class SimpleSweepIntersections {
 /**
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  */
  constructor(walls) {
    this.walls = SimpleSweepIntersections.createLeftRightSweepWalls(walls);
    this.walls.sort(compareXY_A);
    
    // Store intersections keyed by each wall id.
    // Each entry is an array of intersections for that wall.
    this.intersections_map = new MapArray();
    
    this.i = 0; // what wall are we on? Used for step().
  }
  
  // --------------- GETTERS / SETTERS --------------------- //
 /**
  * Sweep not yet done.
  * See run() for an example loop.
  * @type {boolean}
  */
  get incomplete() { return this.i < this.walls.length; }

  /**
   * Run the entire algorithm and return the intersections
   * @return {Map<id, {x, y}[]>}
   */
   run() {
     while(this.incomplete) { this.step(); }
     return this.intersections_map;
   } 
  
  /**
   * Run a single step of the algorithm. Here, processing a single wall.
   * @return {CCWSweepWall} For convenience, return the wall just processed.
   */
   step() {
     const w0 = this.walls[this.i];
     const ln = this.walls.length;
     
     // only test walls to the right of test_wall
     for(let j = (this.i + 1); j < ln; j += 1) {
       const w1 = this.walls[j];
        
        // if we reached the end of the candidate wall w1, we can skip the rest
        if(w1.A.x > w0.B.x) { break; }
     
       if(w0.intersects(w1)) {
         const i_point = w0.intersectSegment(w1.coords);
         
         // count the intersection unless it is an endpoint of that wall
         if(!(pointsAlmostEqual(w0.A, i_point) || 
              pointsAlmostEqual(w0.B, i_point))) {
            this.intersections_map.push(w0.id, { x: i_point.x, y: i_point.y });
         }
          
         // same for the second wall
         if(!(pointsAlmostEqual(w1.A, i_point) || 
              pointsAlmostEqual(w1.B, i_point))) {
            this.intersections_map.push(w1.id, { x: i_point.x, y: i_point.y })  
         } 
       }
     }
     this.i += 1;
     return w0;
   }
}

 /**
  * Modified Bentley-Ottoman sweep algorithm.
  * Determine if walls intersect one another. 
  * By intersect, here we mean that two walls overlap but do not share an endpoint at 
  * the overlap location.
  *
  * This method implements a modified Bentley-Ottoman sweep:
  * - Modified to handle vertical lines
  * - Modified to handle multiple intersecting lines
  *
  * Wall endpoints are either left or right events; intersections are their own event.
  * Each event is a checkpoint for the x-sweep, represented by 
  *   IntersectionSweepEvent class.
  *
  * Requires two sorted queues:
  * 1. Event Queue: Set of events, sorted by increasing (left-to-right) x-coordinates. 
  *                 Implemented as BST
  * 2. Sweep Status: Segments that intersect the x-sweep line, sorted top to bottom (y) 
  *                  So, segments arrange relative to one another along y axis.
  *                  Implemented as Array 
  * For both sorts, vertical lines are sorted top-to-bottom
  *
  * For each event in the event queue:
  * Left event:
  *   Sweep has encountered a new segment. 
  *   Add the segment to the sweep queue.
  *   Check if the segments immediately above or immediately below intersect this segment.
  *   If intersection found, add to the event queue.
  *   (Only the immediately above/below segments can intersect this one without more 
  *   segments added or an intersection encountered.)
  *
  * Right event:
  *   Sweep has encountered the end of a segment
  *   Drop the segment from the sweep queue.
  *   Because this segment ended, the immediate above/below segments could intersect.
  *   If intersection found, add to the event queue.
  *   
  * Intersection event:
  *  2+ walls meet in an intersection. 
  *  Relative y positions of the walls flip as we move right from the intersection.
  *  So flip their positions in the sweep queue. 
  *  (if uneven number, middle wall doesn't flip.)
  *  Check if the new top line intersects the line above it.
  *  Check if the new bottom line intersects the line below it.
  *  (Any other "middle" lines at the intersection can only intersect with one another,
  *   and we already know that intersection---we are at it! Of course, the lines could
  *   intersect with other lines if relative y positions change, but those are covered
  *   elsewhere.
  *   
  * Intersection events store all the walls involved in the intersection as a Map.
  * So if the intersection is encountered again, the additional walls (if any) are added
  * to the intersection wall Map.
  *
  * Time: Theoretically, O(n*log(n) + I * log(n)), 
  *       where n = number segments; I = number intersections
  *       But depends on how well the search tree and array work for this
  */
export class BentleyOttomanSweepIntersections {
  constructor(walls) {
    this.event_queue = new BinarySearchTree(this.compareXY);
    this.sweep_status = [];
    this.intersections_map = new MapArray();
    
    walls.forEach(w => {
      // construct object for needed wall data
      this.event_queue.insert(new IntersectionSweepEvent("left", { wall: w }));
      this.event_queue.insert(new IntersectionSweepEvent("right", { wall: w }));
    });
  }
 
 // --------------- GETTERS / SETTERS --------------------- //

 
 /**
  * Sweep not yet done.
  * See run() for an example loop.
  * @type {boolean}
  */
  get incomplete() { return this.event_queue.size > 0; }
    
 /**
  * Run the entire sweep and return intersections tree
  * @return {BinarySearchTree}
  */
  run() {
    while(this.incomplete) { this.step(); }
    return this.intersections_map;
  }
  
 /**
  * Run a single step of the sweep.
  * @return {IntersectionSweepEvent} The event just processed
  */
  step() {
    const e = this.event_queue.pullMinNode();
    switch(e.event) {
      case "left": this._processLeftEvent(e); break;
      case "right": this._processRightEvent(e); break;
      case "intersection": this._processIntersectionEvent(e); break;
    }
    return e; 
  } 
  
 /**
  * Process when the sweep encounters a left segment 
  * 1. Insert segment of e into sweep based on y-coordinate. Call it s.
  * 2. Set s' and s'' to segments immediately above and below s on sweep line
  *    Remove any event associated with s' or s'' from the event queue
  * 3. Test for intersections between s and s' and between s and s''.
  *    Add events to the queue     
  * @param {IntersectionSweepEvent} e
  * @private
  */
  _processLeftEvent(e) {
    const i = this._insertIntoSweepStatus(e);
    const s1 = this.sweep_status[i - 1]; // above
    const s2 = this.sweep_status[i + 1]; // below
    
    //this._removeFromSweepIntersection(s1, s2, event_queue);
    
    this._testForSweepIntersection(s1, e, e);
    this._testForSweepIntersection(e, s2, e);
  }
  
 /**
  * Process when the sweep encounters a right segment
  * 1. Set s' and s'' to segments immediately above and below s on sweep line
  * 2. Delete segment s from sweep line status
  * 3. Test intersections between s' and s''. Add to event queue 
  * @param {IntersectionSweepEvent} e
  * @private
  */
  _processRightEvent(e) {
    const i = this.sweep_status.findIndex(elem => elem.id === e.id);
    const s1 = this.sweep_status[i - 1]; // above
    const s2 = this.sweep_status[i + 1]; // below
    this._testForSweepIntersection(s1, s2, e);
    this.sweep_status.splice(i, 1); // drop the e segment from sweep queue
  }
  
 /**
  * 1. Report intersection
  * 2. s' and s'' are the two intersecting segments. 
  *    Swap in the sweep line array. If more than two, swap outside-in 
  *    (median line, if any, stays put)
  * 3. Check for intersections between new top and next segment above,
  *    and between new bottom and next segment below. Add to event queue.
  * @param {IntersectionSweepEvent} e
  * @private
  */
  _processIntersectionEvent(e) {
    //this.intersections_map.push(e..insert(e);
    
    // find each wall implicated by the intersection
    // if 2, swap
    // if 3, swap top and bottom 
    // if 4, swap top and bottom, second top with second bottom, etc...
    // test intersection for top and next above
    // test intersection for bottom and next below
    // rest already intersected at this point, so don't need to test
    const walls_arr = [...e.walls.values()];   
    const idxs = walls_arr.map(w => {
      this.intersections_map.push(w.id, { x: e.x, y: e.y });
      return this.sweep_status.findIndex(elem => elem.id === w.id);
    });
    const ln = idxs.length;
    const top_idx = Math.min(...idxs);
    const bottom_idx = Math.max(...idxs);
    const above_idx = top_idx - 1;
    const below_idx = bottom_idx + 1;
    
    // recall that we will be swapping
    // this._removeFromSweepIntersection(this.sweep_status[top_idx], this.sweep_status[above_idx], event_queue);
    // this._removeFromSweepIntersection(this.sweep_status[bottom_idx], this.sweep_status[below_idx], event_queue);
    this._testForSweepIntersection(this.sweep_status[bottom_idx], 
                                   this.sweep_status[above_idx], e);
    this._testForSweepIntersection(this.sweep_status[top_idx],
                                   this.sweep_status[below_idx], e);
    
    // need to swap lowest with highest, 
    // second-lowest with second-highest, etc.
    // by using Math.floor, we stop before getting to a median segment 
    // if we have an uneven number of walls.
    idxs.sort((a,b) => a < b ? -1 : 1) 
    const midpoint = Math.floor(ln / 2);
    for(let i = 0, j = (ln - 1); i < midpoint; i += 1, j -= 1) {
      const low = idxs[i];
      const high = idxs[j]
      arraySwap(this.sweep_status, low, high);
    }
  }

  /**
  * Helper function to insert an item into the sweep array
  * Must insert in y-position. Tie-breakers use x.
  * @param {Object}   segment
  * @return {number} Index of the insertion (after the insertion)
  * @private
  */
  _insertIntoSweepStatus(segment) {
    // simple cases
    const ln = this.sweep_status.length;
    if(ln === 0) {
      this.sweep_status.push(segment);
      return 0;
    }
    
    const sweep_x = segment.x;

    // is it before the first element?
    // if a is less, will be -1
    this.sweep_status[0].x = sweep_x;
    if(this.compareYX(this.sweep_status[0], segment) > -1) {
      this.sweep_status.unshift(segment);
      return 0;
    }
    
    // is it after the last element?
    this.sweep_status[ln - 1].x = sweep_x;
    if(this.compareYX(this.sweep_status[ln - 1], segment) < 1) {
      this.sweep_status.push(segment);
      return ln;
    }
    
    // the above two should take care of a single-element array
    // so can assume below has at least two elements
    
    // binary search the array, testing pairs
    let start = 0, end = ln - 1;
    while(start <= end) {
      // mid-index
      const mid = Math.floor((start + end) / 2);
      
      // are we less than or greater than mid?
      this.sweep_status[mid].x = sweep_x;
      const mid_score = this.compareYX(this.sweep_status[mid], segment);
      // -1: sweep is before segment
      //  1: sweep is after segment
      //  0: equal
      
      if(mid_score === 0) {
        this.sweep_status.splice(mid, 0, segment); // insert just before mid
        return mid;
        //break;
      }
      
      // are we between mid - 1 & mid?
      if(mid_score === 1) {
        // segment is before mid
        this.sweep_status[mid - 1].x = sweep_x;
        if(this.compareYX(this.sweep_status[mid - 1], segment) < 1) {
          // segment is after the mid - 1 and before mid (or equal)
          this.sweep_status.splice(mid, 0, segment); // insert just before mid
          return mid;
          //break;
        } else {
          // look in first half
          end = mid - 1;
        }
      } else {
        // segment is after mid
        this.sweep_status[mid + 1].x = sweep_x;
        if(this.compareYX(this.sweep_status[mid + 1], segment) > -1) {
          // segment is before the mid + 1 and after mid (or equal)
          this.sweep_status.splice(mid + 1, 0, segment); // insert just after mid
          return mid + 1;
          //break;
        } else {
          // look in second half
          start = mid + 1;
        }
      }      
    }
  } 
  
 /**
  * Helper function to compare along the YX axis
  * Additional tie breaker: the segment that has the leftmost starting endpoint
  * wins in case of tie.
  * Used for arranging sweep status. Tiebreaker occurs when the endpoint of one 
  * line intersects in the middle of the other line.
  * @param {IntersectionSweepEvent} a
  * @param {IntersectionSweepEvent} b
  * @return {boolean}
  * @private
  */
  compareYX(a, b) {
    const res = compareYX(a, b);
    //if(res === 0) { return compareYX(a.left, b.left); }
    if(res === 0) {
      if(a.event === "left" && b.event !== "left") return -1;
      if(a.event === "right" && b.event !== "right") return 1;
      if(a.event === "intersection" && b.event === "right") return -1;
      if(a.event === "intersection" && b.event === "left") return 1;
      
      if(a.event === "left" && b.event === "left") {
        // one segment endpoint on the other segment. 
        // either sharing an endpoint or in the middle
      
        // if they share a left endpoint, compare their right endpoints
        // (No intersection will be found, they should be oriented so the 
        //  the one moving up is above the one moving down)
        if(pointsAlmostEqual(a.left, a.right)) { return compareYX(a.right, b.right); }
      
        // One has endpoint in the middle of another
        // a.right --> a --> b.right 
        // CCW: b after a
        // CW: a after b 
        // (just to start, will be swapped at the intersection event)
        // 1 is CCW
        //const ccw = orient2dPoints(a.right, a, b.right)
        //if(ccw > 0) return 1;
        //if(ccw < 0) return -1;
        return orient2dPoints(a.right, a, b.right);
      }
            
      return compareYX(a.left, b.left);
    } 
    return res;
  }
  
  compareXY(a, b) {
    const res = compareXY(a, b);
    if(res === 0) {
     if(a.event === "left" && b.event !== "left") return -1;
     if(a.event === "right" && b.event !== "right") return 1;
     if(a.event === "intersection" && b.event === "right") return -1;
     if(a.event === "intersection" && b.event === "left") return 1;
     return compareXY(a.left, b.left);

    }
    return res;
  }

 
  
 /**
  * Helper function to update event queue with intersection 
  * @param {Object} s1
  * @param {Object} s2
  * @private
  */
  _testForSweepIntersection(s1, s2, e) {
    if(!s1) return;
    if(!s2) return;
    
    const s1_wall = s1.base_wall;
    const s2_wall = s2.base_wall;
    const intersection = s1_wall.intersectSegment(s2_wall.coords);
    
    if(!intersection) return;
    
    // if the intersection is at the endpoints of the two walls, skip
    // (if only endpoint of one, include)
    const endpoint1 = pointsAlmostEqual(s1.left, intersection) || 
                      pointsAlmostEqual(s1.right, intersection)
    
    const endpoint2 = pointsAlmostEqual(s2.left, intersection) || 
                      pointsAlmostEqual(s2.right, intersection)
    if(endpoint1 && endpoint2) return;
    
    
    // construct the intersection so we can find it in the queue if it exists
    const new_intersection = new IntersectionSweepEvent("intersection", { intersection: intersection });
    
    // if the intersection is in the past, skip
    if(this.compareXY(new_intersection, e) === -1) return;
    
    let existing_intersection = this.event_queue.find(new_intersection);
    if(existing_intersection) {
      // update with additional wall(s)
      existing_intersection.data.walls.set(s1_wall.id, s1_wall);
      existing_intersection.data.walls.set(s2_wall.id, s2_wall);
      existing_intersection.event = "intersection"; // probably unnecessary
    } else {
      new_intersection.walls.set(s1_wall.id, s1_wall);
      new_intersection.walls.set(s2_wall.id, s2_wall);
      this.event_queue.insert(new_intersection);  
    }
  }
  
 /**
  * Helper function to update event queue by removing intersection
  * @param {Object} s1
  * @param {Object} s2
  * @private
  */  
  _removeFromSweepIntersection(s1, s2) {
    if(!s1) return;
    if(!s2) return;
    
    const s1_wall = s1.base_wall;
    const s2_wall = s2.base_wall;
    const intersection = s1_wall.intersectSegment(s2_wall.coords)
    
    if(!intersection) return;
     
    this.event_queue.remove(intersection);
  }


}

export class IntersectionSweepEvent {
  constructor(event, { wall = undefined, intersection = undefined} = {}) {
    if(!wall && !intersection) { console.error(`testccw|IntersectionSweepEvent: Either wall or intersection must be provided.`); }
   
    this.event = event;
    this._id = undefined;
    this.walls = new Map(); // used for intersections
    this.coords = undefined;
    this.base_wall = undefined;
   
    if(wall) {
      this._id = wall.data._id;
      this.base_wall = CCWSweepWall.create(wall, {}, { keep_wall_id: true });
      
      this.coords = wall.coords;
      const is_left = almostEqual(this.coords[0], this.coords[2]) ? 
                     this.coords[1] < this.coords[3] : // use top (smaller) y
                     this.coords[0] < this.coords[2]; // use left (smaller) x
      
      this.left = is_left ? { x: this.coords[0], y: this.coords[1] } :
                            { x: this.coords[2], y: this.coords[3] };
      this.right = is_left ? { x: this.coords[2], y: this.coords[3] } :
                             { x: this.coords[0], y: this.coords[1] };                            
           
      this.dx = this.right.x - this.left.x;
      this.dy = this.right.y - this.left.y;
  
      // y = slope*x + b
      // b = y - slope * x
      // if dx === 0, line is vertical
      this.slope = this.dy / this.dx;
      this.y_intercept = almostEqual(this.dx, 0) ? undefined : 
                         this.left.y - this.slope * this.left.x;
      
    } else if(intersection) {
      this.coords = [intersection.x, intersection.y];  
      this.left = { x: intersection.x, y: intersection.y }
      this.right = this.left;
    }
    
    this._sweep_x = undefined; // temp x value to hold current sweep location
    this._sweep_y = undefined; // temp y value to hold current sweep location
  }
  
 /**
  * The id of the associated wall.
  */
  get id() {
    if(!this._id ) { this._id = foundry.utils.randomID(); }
    return this._id;  
  }
  
 /**
  * @type {string}
  */ 
  set id(value ) { this._id = value; }
  
  get x() {
    return this._sweep_x ?? (this.event === "right" ? this.right.x : this.left.x);      
  }
  
  set x(value) {
    this._sweep_x = value;
    this._sweep_y = undefined;
  }
  
  get y() {
    if(this._sweep_y === undefined) { this._sweep_y = this.getY(this.x); }
    return this._sweep_y;
  }

  getY(x) {
    if(this.event === "intersection") return this.left.y;
    if(this.event === "right") return this.right.y;
    
    // vertical
    if(almostEqual(this.dx, 0)) return this.event === "left" ? this.left.y : this.right.y; 
    
    return this.slope * x + this.y_intercept;
  }
  
  draw(color, alpha = 1, width = 1) {
    if(!color) color = this.event === "right" ? COLORS.black : COLORS.red;
  
    if(this.event === "intersection") {
      const pt = new CCWSweepPoint(this.x, this.y);
      pt.draw(color, alpha)
    } else {
      const r = new CCWSightRay({ x: this.left.x, y: this.left.y },
                                { x: this.right.x, y: this.right.y });
     
     r.draw(color, alpha, width);                           
    
    }
  }
}

/**
 * Helper function to construct a set of walls where the A endpoint is to the left
 * (or above) the B endpoint
 * Used by BruteForce and SimpleSweep classes
 * @param {Wall[]|Set<Wall>|Map<Wall>} walls
 * @return {CCWSweepWall[]}
 */
function createLeftRightSweepWalls(walls) {
  const ccw_walls = [];
  walls.forEach(w => {
    // figure out which is left, for sort. 
    const A = { x: w.coords[0], y: w.coords[1] };
    const B = { x: w.coords[2], y: w.coords[3] };
    const is_left = compareXY(A,B) === -1;
    const left = is_left ? A : B; 
    const right = is_left ? B : A; 
    
    // use SweepWall for intersect, intersection methods
    // but keep the id from the wall
    const out = CCWSweepWall.createFromPoints(left, right, w, {}, { keep_wall_id: true });
    ccw_walls.push(out);
  });
  return ccw_walls;
}

Object.defineProperty(BruteForceIntersections, "createLeftRightSweepWalls", {
  value: createLeftRightSweepWalls,
  writable: true,
  configurable: false
});


Object.defineProperty(SimpleSweepIntersections, "createLeftRightSweepWalls", {
  value: createLeftRightSweepWalls,
  writable: true,
  configurable: false
});





