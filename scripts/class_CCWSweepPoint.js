'use strict';

import { CCWPixelPoint } from "./class_CCWPixelPoint.js";

/* 
 * Represent a wall endpoint.
 * Extends CCWPixelPoint, so the x and y are integer coordinates.
 * Stores properties relevant to a wall sweep, 
 * including the field of vision origin and radius if the vision is limited.
 * @extends {CCWPixelPoint}
 * @property {number} x     The x-coordinate
 * @property {number} y     The y-coordinate
 */
export class CCWSweepPoint extends CCWPixelPoint {
  constructor(x, y) {
    super(x, y)

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */
 
    /**
     * Record the walls that connect to this SweepPoint
     * @type {Map<CCWSweepWall>}
     */
    this.walls = new Map();
        
  }
  
  /* -------------------------------------------- */
  /*  Factory Functions                           */
  /* -------------------------------------------- */
  
 /**
  * Construct a CCWSweepPoint from any object that contains x and y.
  * @param {x: number, y: number} p
  * @return CCWSweepPoint
  */ 
  static fromPoint(p) {
    return new this(p.x, p.y);
  }
  
  /* -------------------------------------------- */
  /*  Getters / Setters                           */
  /* -------------------------------------------- */

 

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
 /**
  * Check if this endpoint counts as terrain and so might be excluded. 
  * Hypothesis: 
  * - If any wall is not terrain, endpoint must count as collision
  * - If more than two terrain walls, endpoint must count as collision
  * - If 2 walls, endpoint may or may not count, depending on orientation to vision point.
  * - If wall 1 is in front of wall 2 and vice-versa, then it is a terrain point.
  * @return {boolean} True if a single terrain wall is present in the set
  */
  isTerrainExcluded() {
    const ln = this.walls.size
    
    // 1 non-terrain wall or 2+ terrain walls = counts as collision    
    if(ln === 1) {
      // single wall: if it is terrain, can exclude.
      const wall = this.walls.values().next().value;
      return wall.isTerrain;
    
    } else if(ln === 2) {
      // two walls: both must be terrain to exclude.
      const iter = this.walls.values();
      const wall0 = iter.next().value;
      if(!wall0.isTerrain) return false;
      
      const wall1 = iter.next().value;
      if(!wall1.isTerrain) return false;
      
      // if both terrain but one block the other, do not exclude
      // can tell by checking if non-shared endpoints are on opposite sides.
      // e.g.:
      // V with origin in middle: O can see both non-shared endpoints; 1 on either side.
      // V with origin on one side: O sees both non-shared on the same side.
      return wall0.leftEndpoint.almostEqual(wall1.rightEndpoint) ||
             wall0.rightEndpoint.almostEqual(wall1.leftEndpoint);
    } 
    
    // if 0 walls or more than 2, this endpoint counts as collision.
    return false;
  }
  
  /**
   * Determine if this is an endpoint for one or more terrain walls
   * @param {string} type   Type of vision: light, sight, sound
   * @return {boolean} True if one or more terrain walls present.
   */
   hasTerrainWalls(type) {
     if(this.walls.size === 0) return false;
     return [...this.walls.values()].some(w => w.data?.[type] === 2);
   }
}

