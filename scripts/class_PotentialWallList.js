// Class to store list of potential walls.
// Ultimately should probably be a binary search tree.
// Assumptions:
// - ordered from furtherest to closest walls.
// - sweeping clockwise
// - walls can be ignored && removed if CCW of current sweep sight ray
// - walls should be added if CW of current sweep sight ray. 
// - in line walls? Add?
import { log, MODULE_ID } from "./module.js";
import { pointsAlmostEqual, ccwPoints } from "./util.js";


export class PotentialWallList {
  constructor(origin) {
    this.origin = origin;
    this.potential_walls = new Map();
    this.walls_encountered = new Set();
  }
  
 /*
  * Add walls to the list.
  * Triggers a sort.
  * @param {Array|Set|Map} walls    Walls to add.
  */ 
  add(walls) {  
    if(walls.size === 0 || walls.length === 0) return;
    walls.forEach(w => {
      this.walls_encountered.add(w.id);
      this.potential_walls.set(w.id, w);
    });
    
    if(this.potential_walls.size > 0 || (walls.size > 1 || walls.length > 1)) { this.sort(); }
  }
  
 /*
  * Remove walls from the list
  * Should not require a sort.
  * @param {Array|Set|Map} walls    Walls to remove.
  */
  remove(walls) {  
    walls.forEach(w => {
      this.walls_encountered.delete(w.id);
      this.potential_walls.delete(w.id);
    });
  } 
  
 /*
  * Remove walls from list given array of ids
  * @param {Array|Set|Map} wall_ids   Walls to remove
  */
  removeById(wall_ids) {
    wall_ids.forEach(id => {
      this.walls_encountered.delete(id);
      this.potential_walls.delete(id);
    });
  } 
  
 /*
  * Sort list of walls.
  */
  sort() {
    if(window[MODULE_ID].debug) log("sorting");
    this.potential_walls = new Map([...this.potential_walls.entries()].sort((a, b) => {
    // greater than 0: sort b before a (a is in front of b)
    // less than 0: sort a before b (b is in front of a)
    return a[1].toRay().inFrontOfSegment(b[1].toRay(), this.origin) ? 1 : -1;
  }));    
  } 

 /*
  * Add walls connected to an endpoint to the list.
  * @param {Endpoint} endpoint    Endpoint containing 0+ walls connected to it.
  */
  addFromEndpoint(endpoint) {
    // endpoint.walls are a Set
  
    const to_remove = [];
    const to_add = [];
    
    endpoint.walls.forEach(w => {
      // if we have already seen it, it must be CCW
      // or (unlikely) it is otherwise CCW
      if(this.walls_encountered.has(w.id) || 
           endpointWallCCW(this.origin, endpoint, w) > 0) {
         to_remove.push(w.id)
      } else {
        to_add.push(w);
      }
    })
    
    this.removeById(to_remove);
    this.add(to_add);
  }
   
  
 /*
  * Retrieve the closest wall to the origin.
  * @param {boolean} remove     Default is to remove the closest (pop)
  * @return {Wall}
  */
  closest(remove = true) {
    if(this.potential_walls.size === 0) return undefined;
    
    const keys = [...this.potential_walls.keys()];
    const popkey = keys[keys.length - 1];
    const obj = this.potential_walls.get(popkey);
    
    if(remove) this.remove([obj]);
    return obj;
  }
}

// 1 if CCW, -1 if CW, 0 if in line
function endpointWallCCW(origin, endpoint, wall) {
  const non_anchor = pointsAlmostEqual(wall.A, endpoint) ? wall.B : wall.A;
  return ccwPoints(origin, endpoint, non_anchor);
}
