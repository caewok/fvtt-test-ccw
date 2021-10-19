'use strict';

import { CCWPixelPoint } from "./class_CCWPixelPoint.js";
import { almostEqual, 
         inCirclePoints } from "./util.js";

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
  constructor(x, y, {origin, radius} = {}) {
    super(x, y)

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */
 
    /**
     * Record the set of walls which connect to this Endpoint
     * @type {Set<CCWSweepWall>}
     */
    this.walls = new Set();
    
    /**
     * Origin for the sweep.
     * Only required if insideRadius is used.
     * @type {x: number, y: number}
     * @private
     */
    this._origin = origin;
    
    /**
     * Radius of the FOV.
     * Only required if insideRadius is used.
     * Should be strictly positive.
     * @type {number}
     * @private
     */
    this._radius = radius;
        
    /**
     * Cache whether this point is inside the FOV radius.
     * @type {boolean}
     * @private
     */
    this._insideRadius = undefined;
    
    /**
     * Cache the distance squared to the origin
     * @type {number}
     * @private
     */
    this._distanceSquaredToOrigin = undefined;
  }
  
  /* -------------------------------------------- */
  /*  Factory Functions                           */
  /* -------------------------------------------- */
  
 /**
  * Construct a CCWPoint from any object that contains x and y.
  * @param {x: number, y: number} p
  * @return CCWPoint
  */ 
  static fromPoint(p, { origin, radius } = {}) {
    return new this(p.x, p.y, origin, radius);
  }
  
  /* -------------------------------------------- */
  /*  Getters / Setters                           */
  /* -------------------------------------------- */
  
 /**
  * @type {number}
  */
  get radius() { return this._radius; }
  
 /**
  * @type {x: number, y: number}
  */
  get origin() { return this._origin; }
    
  /** 
   * Is this point associated with a radius? Radius 0 does not count.
   * @return {boolean}
   */
  get hasRadius() {
    return Boolean(this._radius);
  }
  
  /**
   * Distance squared to origin. Used for comparisons.
   * @type {number}
   */
  get distanceSquaredToOrigin() {
    if(this._distanceSquaredToOrigin === undefined) {
      this._distanceSquaredToOrigin = this.distanceSquared(this.origin);
    }
    return this._distanceSquaredToOrigin;
  }
    
  /**
   * Is this point inside the FOV radius?
   * @type {undefined|boolean}
   */
  get insideRadius() {
    if(!this.hasRadius || !this.origin) return undefined;
    if(this._insideRadius === undefined) { 
      const res = inCirclePoints(this._circlePoints[0],
                                 this._circlePoints[1],
                                 this._circlePoints[2],
                                 this);
                           
      this._insideRadius = almostEqual(res, 0) ? true :  // on the circle
                           res > 0 ? false : true;                     
    }
    return this._insideRadius;
  }
  
  /**
   * When setting origin, un-cache measurements that depend on it.
   * @param {x: number, y: number} value
   */
  set origin(value) {
    this._origin = value;
    this._distanceSquaredToOrigin = undefined;
    this._insideRadius = undefined;
    this._updateCirclePoints();
  }
  
  /**
   * When setting radius, un-cache measurements that depend on it.
   * @param {number} value
   */
  set radius(value) {
    this._radius = value;
    this._insideRadius = undefined;
    this._updateCirclePoints();
  }
  

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
  // TO-DO: Cache isTerrainExcluded and hasTerrainWalls
  // Would need to set the "type" as a cached property, 
  //   and monitor wall additions/deletions
  /**
   * Check if this endpoint counts as terrain and so might be excluded. 
   * Hypothesis: 
   * - If any wall is not not terrain, endpoint must count as collision
   * - If more than two terrain walls, endpoint must count as collision
   * - If 2 walls, endpoint may or may not count, depending on orientation to vision point.
   *   - If wall 1 is in front of wall 2 and vice-versa, then it is a terrain point.
   * @param {string}    type   Type of vision: light, sight, sound
   * @return {boolean} True if a single terrain wall is present in the set
   */
  isTerrainExcluded(type) {
    const ln = this.walls.size
    if(ln !== 1 && ln !== 2) return false;
    const walls = [...this.walls.values()];
    if(walls.some(w => w.data?.[type] !== 2)) return false;
    if(ln === 1) return true;

    // if the both block equally, it is a terrain point
    // if neither block, it is a terrain point
    // TO-DO: should inFrontOfSegment return true when both block equally?

    const wall0_in_front = walls[0].inFrontOfSegment(walls[1], this.origin);
    const wall1_in_front = walls[1].inFrontOfSegment(walls[0], this.origin);
    if(wall0_in_front && wall1_in_front) return true;
    if(!wall0_in_front && !wall1_in_front) return true;
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

