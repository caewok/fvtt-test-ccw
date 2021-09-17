// Class to store list of potential walls.
// Assumptions:
// - ordered from furtherest to closest walls.
// - sweeping clockwise
// - walls can be ignored && removed if CCW of current sweep sight ray
// - walls should be added if CW of current sweep sight ray. 
// - in line walls? Add?
import { log, MODULE_ID } from "./module.js";
import { pointsAlmostEqual, ccwPoints } from "./util.js";
import { BinarySearchTree } from "./class_BinarySearchTree.js";


/**
 * Store ordered list of potential walls, ordered by closeness to the origin.
 * @extends {BinarySearchTree}
 * @property {PIXI.Point} origin              {x,y} origin point for the light/vision/etc.
 * @property {Set}        walls_encountered   Cache of wall ids checked when adding 
 *                                              or removing walls 
 */  
export class PotentialWallList extends BinarySearchTree {
  constructor(origin) {
    super();
    this.origin = origin;
    this.walls_encountered = new Set(); 
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
 /**
  * Override the BST compare function to sort walls in relation to origin.
  * @param {Wall} a  Wall object
  * @param {Wall} b  Wall object 
  */
  compare(a, b) {
    if(a.id === b.id) return 0;
    const res = a.toRay().inFrontOfSegment(b.toRay(), this.origin);
    if(res === undefined) {
     log(`BST compare returned undefined`, res, this);
    }
    return !res ? -1 : 1;
  } 
  
 /**
  * Add walls to the list.
  * @param {Array|Set|Map} walls    Walls to add.
  */ 
  addWalls(walls) {  
    walls.forEach(w => {
      if(!this.walls_encountered.has(w.id)) {
        this.walls_encountered.add(w.id);
        this.insert(w);      
      }
    });
  }
  
 /**
  * Remove walls from the list
  * @param {Array|Set|Map} walls    Walls to remove.
  */
  removeWalls(walls) {  
    //log(`Checking to remove ${walls?.length}|${walls?.size}`, walls);
    walls.forEach(w => {
      if(this.walls_encountered.has(w.id)) {
        //log(`Removing ${w?.id}`, w, this);
        this.walls_encountered.delete(w.id);
        this.remove(w);
      }  
    });
  } 
    
 /**
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
           PotentialWallListBinary.endpointWallCCW(this.origin, endpoint, w) > 0) {
         to_remove.push(w)
      } else {
        to_add.push(w);
      }
    })
    
    this.removeWalls(to_remove);
    this.addWalls(to_add);
  }
   
  
 /**
  * Retrieve the closest wall to the origin.
  * @param {boolean} remove     Default is to remove the closest (pop)
  * @return {Wall}
  */
  closest(remove = true) {
    if(this.walls_encountered.size === 0) return undefined;
    
    if(remove) {
      const w = this.pullMaxNode();
      this.walls_encountered.delete(w.id);
      return w;
    }
  
    return this.findMaxNode();
  }
  
 /**
  * Determine if a far wall, opposite the endpoint, is CCW or CW given a vision point.
  * origin --> endpoint --> first wall endpoint not equal to endpoint
  * @param {x, y} origin    Vision point
  * @param {x, y} endpoint  Object with x,y coordinates
  * @param {A: {x,y}, B: {x,y}} wall  Object like a Wall or Ray with A and B endpoints.
  * @return {1|0|-1} 1 if CCW, -1 of CW, 0 if in line 
  */
  static endpointWallCCW(origin, endpoint, wall) {
     const non_anchor = pointsAlmostEqual(wall.A, endpoint) ? wall.B : wall.A;
     return ccwPoints(origin, endpoint, non_anchor);
  }
}
