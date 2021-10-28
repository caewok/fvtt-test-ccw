// Class to store list of potential walls.
// Assumptions:
// - only need to know the closest and potentially second-closest wall
// - sweeping clockwise
// - walls can be ignored && removed if CCW of current sweep sight ray
// - walls should be added if CW of current sweep sight ray. 

import { PriorityQueueMap } from "./class_PriorityQueueMap.js";
import { CCWPoint }         from "./class_CCWPoint.js";

/**
 * Store ordered list of potential walls, ordered by closeness to the origin.
 * @extends {BinarySearchTree}
 * @property {PIXI.Point} origin              {x,y} origin point for the light/vision/etc.
 * @property {Set}        walls_encountered   Cache of wall ids checked when adding 
 *                                              or removing walls 
 */  
export class PotentialWallList extends PriorityQueueMap {
  constructor() {
    super(PotentialWallList.inFrontOf);
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
      if(!this.has(w)) {
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
      if(this.has(w)) {
        //log(`Removing ${w?.id}`, w, this);
        this.remove(w);
      }  
    });
  } 
    
 /**
  * Add walls connected to an endpoint to the list.
  * @param {Endpoint} endpoint    Endpoint containing 0+ walls connected to it.
  */
  updateWallsFromEndpoint(endpoint) {
    // endpoint.walls are a Set
  
    const to_remove = [];
    const to_add = [];
    
    endpoint.walls.forEach(w => {
      // walls with this endpoint as the left endpoint should be added
      // walls with this endpoint as the right endpoint should be removed
      if(w.leftEndpoint.almostEqual(endpoint)) {
        to_add.push(w)
      } else if(w.rightEndpoint.almostEqual(endpoint)){
        to_remove.push(w)
      } else {
        // for debugging; can remove the rightEndpoint test later.
        console.error(`testccw|updateWallsFromEndpoint: Encountered wall that does not share endpoint.`);
      }
    });
    
    this.removeWalls(to_remove);
    this.addWalls(to_add);
  }
     
  
 /**
  * Remove walls connected to an endpoint from the list 
  *  
  
 /**
  * Retrieve the closest wall to the origin
  * @param {boolean} remove         Default is to remove the closest (pop)
  * @param {boolean} skip_terrain   If the closest is a terrain wall, 
  *                                 retrieve next-closest
  * @return {Wall}
  */
  closest() { return this.first; }
  
 /**
  * Retrieve the second-closest wall to the origin
  * @return {Wall}
  */
  secondClosest() { return this.second; }

 /**
  * Determine if a far wall, opposite the endpoint, is CCW or CW given a vision point.
  * origin --> endpoint --> first wall endpoint not equal to endpoint
  * @param {x, y} origin    Vision point
  * @param {x, y} endpoint  Object with x,y coordinates
  * @param {A: {x,y}, B: {x,y}} wall  Object like a Wall or Ray with A and B endpoints.
  * @return {1|0|-1} 1 if CCW, -1 of CW, 0 if in line 
  */
  static endpointWallCCW(origin, endpoint, wall) {
     const non_anchor = endpoint.almostEqual(wall.A) ? wall.B : wall.A;
     return CCWPoint.ccw(origin, endpoint, non_anchor);
  }
  
 /**
  * Is this wall in front of another, with respect to origin/vision point?
  * Similar to testing whether a segment occludes another with relation to a 
  * vision point, but has additional assumptions that make this test easier:
  * 1. no overlapping segments.
  * 2. segments are added because they are in line around a radial sweep, meaning
  *    that for segments AB and BC, A/B and C/D are to the left, and vice-versa
  *    for the respective other endpoints to the right. 
  *    In other words, segments AB and BC will not be on opposite sides of origin, 
  *    but rather, origin --> intersects AB --> intersects BC or 
  *                origin --> intersects BC --> intersects AB
  *
  * @param {Wall} AB    
  * @param {Wall} CD
  * @param {PIXI.Point} origin
  * @return {-1, 0, 1} -1 if AB is in front, 1 if CD is in front, 0 if equal
  */
  static inFrontOf(AB, CD, origin = AB.origin) {
    //const origin = AB.origin;
    
    if(AB.id && CD.id && AB.id === CD.id) return 0;
   
    const A = AB.A;
//     const B = AB.B;
    const C = CD.A;
    const D = CD.B;
  
    // Test what side BC and origin are in relation to AB
    const ABO = AB.ccw(origin); 
    const ABC = AB.ccw(C);
    const ABD = AB.ccw(D);

    if(ABO === 0 && ABC === 0 && ABD === 0) {
      // either they are the same or they are colinear to the origin
      // id check above can be used to check if they are the same
      // otherwise, could use almostEqual to compare A, B, C, and D
      // here, assume colinear. For sorting, need one in front of the other.
      // so pick the closer of OA or OC (recall no overlaps)
      const OA = new AB.constructor(origin, A);
      const OC = new CD.constructor(origin, C);
      
      return OA.distanceSquared < OC.distanceSquared ? -1 : 1;
    }
    
    // If the origin is on the same side as CD, then CD is in front of AB
    if(ABO === ABC && ABO === ABD) return 1;
    
    // If the origin is on the opposite side of CD, AB is in front
    if(ABO !== ABC && ABO !== ABD) return -1;
    
    // CD crosses the AB infinite line. 
    // Test where A and O are in relation to C
    const CDO = CD.ccw(origin);
    const CDA = CD.ccw(A);
    
    // If A and O are on same side of CD, AB is in front
    if(CDO === CDA) return -1;
    
    return 1;
  } 
  
  
}
