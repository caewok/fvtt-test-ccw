import { arraySwap } from "./util.js";
import { almostEqual, 
         pointsAlmostEqual, 
         COLORS,
         compareXY,
         compareXY_A,
         compareYX } from "./util.js";
import { CCWSightRay } from "./class_CCWSightRay.js";
import { CCWSweepWall }       from "./class_CCWSweepWall.js";
import { CCWSweepPoint }      from "./class_CCWSweepPoint.js";
import { BinarySearchTree } from "./class_BinarySearchTree.js";

export class IntersectionSweep {
  constructor(event, { wall = undefined, intersection = undefined} = {}) {
    if(!wall && !intersection) { console.error(`testccw|IntersectionSweepEvent: Either wall or intersection must be provided.`); }
   
    this.event = event;
    this.id = undefined;
    this.walls = new Map();
    this.coords = undefined;
   
    if(wall) {
      this.id = wall.id;
      this.walls.set(wall.id, wall);
      
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
    if(this.event === "intersection") return this.left.x;
    if(this.event === "right") return this.right.y;
    
    // vertical
    if(almostEqual(this.dx, 0)) return this.event === "left" ? this.left.y : this.right.y; 
    
    return this.slope * x + this.y_intercept;
  }
  
  draw(color = COLORS.red, alpha = 1, width = 1) {
    if(this.event === "intersection") {
      const pt = new CCWSweepPoint(this.x, this.y);
      pt.draw(color, alpha)
    } else {
      const r = new CCWSightRay({ x: this.left.x, y: this.left.y },
                                { x: this.right.x, y: this.right.y });
     r.draw(color, alpha, width);                           
    
    }
  }
  
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
  * @param {Object[]}                   intersections {walls (Map), x, y}   
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {Wall[]}
  */
  static buildWallsFromIntersections(intersections, walls) {
    if(intersections.length === 0) return walls;
    
    // for each intersection, build set of new walls
    // issues:
    // 1. Each wall could have multiple intersections
    // 2. Once we split a wall, it is difficult to find its subsets in the intersections
    // solution: run through each wall instead of each intersection
    const map_walls = new Map();
    walls.forEach(w => map_walls.set(w.id, w));
    
    walls.forEach(w => {
      const intersection_objs = intersections.filter(i => {
        return [...i.walls.values()].some(i_w => i_w.id === w.id);
      });
      
      if(intersection_objs.length === 0) return;
      
      intersection_objs.sort(compareXY);
      
      // for each intersection, create a wall segment
      // need the left and right coords for the remaining_w
      const A = { x: w.coords[0], y: w.coords[1] };
      const B = { x: w.coords[2], y: w.coords[3] };
      const is_left = compareXY(A,B) === -1;
      const left = is_left ? A : B; 
      const right = is_left ? B : A; 
      let remaining_w = CCWSweepWall.createFromPoints(left, right, w);
      
      intersection_objs.forEach(obj => {
        // new_w is the wall to the "left" of the intersection
        // if the intersection is at an endpoint, don't do anything
        if(pointsAlmostEqual(remaining_w.A, obj) || 
           pointsAlmostEqual(remaining_w.B, obj)) { return; }
        
        const new_w = CCWSweepWall.createFromPoints(remaining_w.A, obj, w); 
        remaining_w = CCWSweepWall.createFromPoints(obj, remaining_w.B, w); 
        
        map_walls.set(new_w.id, new_w);                                             
      });
      
      map_walls.set(remaining_w.id, remaining_w);
      map_walls.delete(w.id);
    });
    
    return [...map_walls.values()];
  }  
  
 /**
  * Determine if walls intersect one another.
  * Brute force version that should run in O(n^2)
  * For each pair of walls, check for an intersection. If intersection, add to BST.
  * Using BST for the search feature, so we can find existing intersections.
  * Search is using x, then y if x is equal for two intersections.
  * The result is a set of intersections, each storing 2+ walls.
  * buildWallsFromIntersections then does the wall splitting.
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {Wall[]}
  */
  static processWallIntersectionsBruteForce(walls) { 
    // BST avoids repeating intersections
    const intersections = new BinarySearchTree(compareXY);
    walls.forEach(w0 => {
      // need the intersect method from SightRay or SweepWall
      const r0 = CCWSweepWall.create(w0); 
      walls.forEach(w1 => {
        const r1 = CCWSweepWall.create(w1)
        if(r0.intersects(r1)) {
          const i = r0.intersectSegment(r1.coords);
        
          let existing_intersection = intersections.find(i);
          if(existing_intersection) {
            // update with the additional wall
            existing_intersection.data.walls.set(w0.id, w0);
            existing_intersection.data.walls.set(w1.id, w1);
            
          } else {
            existing_intersection = {
              walls: new Map(),
              x: i.x,
              y: i.y
            };
            existing_intersection.walls.set(w0.id, w0);
            existing_intersection.walls.set(w1.id, w1);
            intersections.insert(existing_intersection);
          }
        }
      });
    });     
    return IntersectionSweep.buildWallsFromIntersections(intersections.inorder(), walls);
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
  static processWallIntersectionsSimpleSweep(walls) {
    const sorted_walls = [];
    walls.forEach(w => {
      // figure out which is left, for sort. 
      const A = { x: w.coords[0], y: w.coords[1] };
      const B = { x: w.coords[2], y: w.coords[3] };
      const is_left = compareXY(A,B) === -1;
      const left = is_left ? A : B; 
      const right = is_left ? B : A; 
      
      // use SweepWall for intersect, intersection methods
      // but keep the id from the wall for use by buildWallsFromIntersections
      const out = CCWSweepWall.createFromPoints(left, right, w);
      out.id = w.id;
      sorted_walls.push(out);
    });

    sorted_walls.sort(compareXY_A);
    
    // BST avoids repeating intersections
    // The rest here is the same basic structure as Brute Force but with fewer tests
    // (See how the j loop skips walls and has an early breakout)
    const intersections = new BinarySearchTree(compareXY);

    const ln = sorted_walls.length;
    for(let i = 0; i < ln; i += 1) {
      const test = sorted_walls[i];
    
      // only test walls to the right of test_wall
      for(let j = (i + 1); j < ln; j += 1) {
        const candidate = sorted_walls[j];
        
        // if we reached the end of the candidate wall, we can skip the rest
        if(candidate.A.x > test.B.x) { break; }
        
        if(test.intersects(candidate)) {
          const i_point = test.intersectSegment(candidate.coords);
        
          let existing_intersection = intersections.find(i_point);
          if(existing_intersection) {
            // update with the additional wall
            existing_intersection.data.walls.set(test.id, test);
            existing_intersection.data.walls.set(candidate.id, candidate);
            
          } else {
            existing_intersection = {
              walls: new Map(),
              x: i_point.x,
              y: i_point.y
            };
            existing_intersection.walls.set(test.id, test);
            existing_intersection.walls.set(candidate.id, candidate);
            intersections.insert(existing_intersection);
          }
        }
      }
    }      
    return IntersectionSweep.buildWallsFromIntersections(intersections.inorder(), walls);
  }
  
 /**
  * Combines the Simple Sweep with buildWallsFromIntersections in a single loop.
  * Requires a sort of the intersections for a given wall.
  * But we piggy-back off the existing i-loop to split the wall once we are done 
  * looking for intersections, which appears to be a decent speed-up over Simple Sweep.
  * @param {Wall[]|Set<Wall>|Map<Wall>} walls
  * @return {Wall[]}  
  */
  static processWallIntersectionsSimpleSweepCombined(walls) {
    // Array to track walls or wall pieces once we know them.
    const finished_walls = [];
    
    // sort the walls 
    const sorted_walls = [];
    walls.forEach(w => {
      // figure out which is left, for sort. 
      const A = { x: w.coords[0], y: w.coords[1] };
      const B = { x: w.coords[2], y: w.coords[3] };
      const is_left = compareXY(A,B) === -1;
      const left = is_left ? A : B; 
      const right = is_left ? B : A; 
      
      // use SweepWall for intersect, intersection methods
      // but keep the id from the wall for use by buildWallsFromIntersections
      const out = CCWSweepWall.createFromPoints(left, right, w);
      out.id = w.id;
      sorted_walls.push(out);
    });
    
    sorted_walls.sort(compareXY_A);
    
    // The Map will store intersections keyed by each wall id.
    // Each entry is an array of intersections for that wall.
    const intersections_map = new Map();
    
    const ln = sorted_walls.length;
    for(let i = 0; i < ln; i += 1) {
      let test = sorted_walls[i];
      
      // only test walls to the right of test_wall
      for(let j = (i + 1); j < ln; j += 1) {
        const candidate = sorted_walls[j];
      
        // if we reached the end of the candidate wall, we can skip the rest
        if(candidate.A.x > test.B.x) { break; }
        
        if(test.intersects(candidate)) {
          const i_point = test.intersectSegment(candidate.coords);
          
          // count the intersection unless it is an endpoint of that wall
          if(!(pointsAlmostEqual(test.A, i_point) || 
               pointsAlmostEqual(test.B, i_point))) {
            const intersections_arr = intersections_map.get(test.id) ?? [];
            intersections_arr.push({ x: i_point.x, y: i_point.y });
            intersections_map.set(test.id, intersections_arr);   
          }
           
          // same for candidate wall.
          if(!(pointsAlmostEqual(candidate.A, i_point) || 
               pointsAlmostEqual(candidate.B, i_point))) {
            const intersections_arr = intersections_map.get(candidate.id) ?? [];
            intersections_arr.push({ x: i_point.x, y: i_point.y });
            intersections_map.set(candidate.id, intersections_arr);
          }
        }
      }
      // fetch and apply saved intersections for this test wall
      const test_intersections = intersections_map.get(test.id);
      
      if(test_intersections?.length > 0) {         
        test_intersections.sort(compareXY);         
        test_intersections.forEach(i_point => {
          // check that we are not repeating points
          if(pointsAlmostEqual(test.A, i_point)) return;
          
          const new_w = CCWSweepWall.createFromPoints(test.A, i_point, test); 
          finished_walls.push(new_w);
          
          // check that we are not repeating points
          if(pointsAlmostEqual(i_point, test.B)) return;
          test = CCWSweepWall.createFromPoints(i_point, test.B, test);
        });
      }
      
      // done with the ith wall. Add remainder to the wall array
      finished_walls.push(test);
    }
      
    return finished_walls;
  }
  
 /**
  * Determine wall intersections using a Bentley Ottoman sweep algorithm.
  * See BentleyOttomanSweep class for details.
  */
  static processWallIntersectionsBentleyOttomanSweep(walls) {
    const sweeper = new BentleyOttomanSweep(walls);
    const intersection_tree = sweeper.run();
    return IntersectionSweep.buildWallsFromIntersections(intersection_tree.inorder(), walls);
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
export class BentleyOttomanSweep {
  constructor(walls) {
    this.event_queue = new BinarySearchTree(compareXY);
    this.sweep_status = [];
    this.intersections = new BinarySearchTree(compareXY);
    
    walls.forEach(w => {
      // construct object for needed wall data
      this.event_queue.insert(new IntersectionSweep("left", { wall: w }));
      this.event_queue.insert(new IntersectionSweep("right", { wall: w }));
    });
  }
    
 /**
  * Run the entire sweep and return intersections tree
  * @return {BinarySearchTree}
  */
  run() {
    while(this.event_queue.size > 0) { this.step(); }
    return this.intersections;
  }
  
 /**
  * Run a single step of the sweep.
  */
  step() {
    const e = this.event_queue.pullMinNode();
    switch(e.event) {
      case "left": this._processLeftEvent(e); break;
      case "right": this._processRightEvent(e); break;
      case "intersection": this._processIntersectionEvent(e); break;
    }
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
    
    this._testForSweepIntersection(s1, e);
    this._testForSweepIntersection(e, s2);
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
    this._testForSweepIntersection(s1, s2);
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
    this.intersections.insert(e);
    
    // find each wall implicated by the intersection
    // if 2, swap
    // if 3, swap top and bottom 
    // if 4, swap top and bottom, second top with second bottom, etc...
    // test intersection for top and next above
    // test intersection for bottom and next below
    // rest already intersected at this point, so don't need to test
    const walls_arr = [...e.walls.values()];   
    const idxs = walls_arr.map(w => 
                   this.sweep_status.findIndex(elem => elem.id === w.id));
     
    const top_idx = Math.min(...idxs);
    const bottom_idx = Math.max(...idxs);
    const above_idx = top_idx - 1;
    const below_idx = bottom_idx + 1;
    
    // recall that we will be swapping
    // this._removeFromSweepIntersection(this.sweep_status[top_idx], this.sweep_status[above_idx], event_queue);
    // this._removeFromSweepIntersection(this.sweep_status[bottom_idx], this.sweep_status[below_idx], event_queue);
    this._testForSweepIntersection(this.sweep_status[bottom_idx], 
                                   this.sweep_status[above_idx]);
    this._testForSweepIntersection(this.sweep_status[top_idx],
                                   this.sweep_status[below_idx]);
    
    // need to swap lowest with highest, 
    // second-lowest with second-highest, etc.
    // by using Math.floor, we stop before getting to a median segment 
    // if we have an uneven number of walls.
    idxs.sort((a,b) => a < b ? -1 : 1) 
    const ln = idxs.length;
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
    if(compareYX(this.sweep_status[0], segment) > -1) {
      this.sweep_status.unshift(segment);
      return 0;
    }
    
    // is it after the last element?
    this.sweep_status[ln - 1].x = sweep_x;
    if(compareYX(this.sweep_status[ln - 1], segment) < 1) {
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
      const mid_score = compareYX(this.sweep_status[mid], segment);
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
        if(compareYX(this.sweep_status[mid - 1], segment) < 1) {
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
        if(compareYX(this.sweep_status[mid + 1], segment) > -1) {
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
  * Helper function to update event queue with intersection 
  * @param {Object} s1
  * @param {Object} s2
  * @private
  */
  _testForSweepIntersection(s1, s2) {
    if(!s1) return;
    if(!s2) return;
    
    const s1_wall = s1.walls.values().next().value;
    const s2_wall = s2.walls.values().next().value;
    const intersection = s1_wall.toRay().intersectSegment(s2_wall.coords);
    
    if(!intersection) return;
    
    let existing_intersection = this.event_queue.find(intersection);
    if(existing_intersection) {
      // update with additional wall(s)
      existing_intersection.data.walls.set(s1_wall.id, s1_wall);
      existing_intersection.data.walls.set(s2_wall.id, s2_wall);
      existing_intersection.event = "intersection"; // probably unnecessary
    } else {
      const new_intersection = new IntersectionSweep("intersection", { intersection: intersection });
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
    
    const s1_wall = s1.walls.values().next().value;
    const s2_wall = s2.walls.values().next().value;
    const intersection = s1_wall.toRay().intersectSegment(s2_wall.coords)
    
    if(!intersection) return;
     
    this.event_queue.remove(intersection);
  }


}




