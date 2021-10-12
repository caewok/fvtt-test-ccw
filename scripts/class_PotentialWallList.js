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
  * Override the BST compare function to sort walls in relation to origin.
  * Closest wall is minNode
  * @param {Wall} a  Wall object
  * @param {Wall} b  Wall object 
  */
function sortWallsAroundOrigin(a, b) {
    if(a.id === b.id) return 0;
    const res = a.inFrontOfSegment(b, this.origin);
    if(res === undefined) {
     log(`BST compare returned undefined`, res, this);
    }
    return res ? -1 : 1;
  } 

/**
 * Store ordered list of potential walls, ordered by closeness to the origin.
 * @extends {BinarySearchTree}
 * @property {PIXI.Point} origin              {x,y} origin point for the light/vision/etc.
 * @property {Set}        walls_encountered   Cache of wall ids checked when adding 
 *                                              or removing walls 
 */  
export class PotentialWallList extends BinarySearchTree {
  constructor(origin) {
    super(sortWallsAroundOrigin);
    this.origin = origin;
    this.walls_encountered = new Set(); 
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  

  
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
           PotentialWallList.endpointWallCCW(this.origin, endpoint, w) >= 0) {
         to_remove.push(w)
      } else {
        to_add.push(w);
      }
    })
    
    this.removeWalls(to_remove);
    this.addWalls(to_add);
  }
   
  
 /**
  * Retrieve the closest wall to the origin
  * @param {boolean} remove         Default is to remove the closest (pop)
  * @param {boolean} skip_terrain   If the closest is a terrain wall, 
  *                                 retrieve next-closest
  * @return {Wall}
  */
  closest({remove = false, skip_terrain = true, type = "sight"} = {}) {
    if(this.walls_encountered.size === 0) return undefined;
    
    let w = undefined;
    if(remove) {
      w = this.pullMinNode();
      this.walls_encountered.delete(w.id);
    } else {
      w = this.findMinNode().data;
    }

    if(skip_terrain && w.data?.[type] === 2) {
      // w.data[type] === 2 if the wall is limited for the type of vision 
      //  (sight, sound, light)
      w = this.secondClosest();
    }

    return w;
  }
  
 /**
  * Retrieve the second-closest wall to the origin
  * @return {Wall}
  */
  secondClosest() {
    if(this.walls_encountered.size < 2) return undefined;
    return this.nthInOrder(2);
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
