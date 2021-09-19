'use strict';

import { CCWSightRay } from "./class_CCWSightRay.js";
import { almostEqual, orient2dPoints } from "./util.js";

/*
 * Subclass of CCWSightRay used for storing Wall segments used in the CCW Sweep algorithm.
 * CCWSightRay extends Ray, so these are basically Ray versions of Wall segments
 * @extends{CCWSightRay}
 */
export class CCWSweepWall extends CCWSightRay {
  constructor(A, B, {origin, radius} = {}) {
    super(A, B);

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /**
     * Is this wall door open? False if not a door or closed.
     * @type {boolean} 
     */
    this.isOpen;
   
    /*
     * Wall data
     * @type {object}   
     */
    this.data;
    
    /*
     * Does the wall have a reference to a roof that is occluded?
     */
    this.isInterior;
    
    /**
     * Origin for the sweep.
     * Only required if insideRadius is used.
     * @type {PIXI.Point}
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
       
    /*
     * Store the intersections to the viewing radius circle, if any.
     * Distinguish undefined (not yet stored) from [], meaning none found.
     */
    this._radiusIntersections = undefined; 
    
  }
  
  /* -------------------------------------------- */
  /*  Getters / Setters                           */
  /* -------------------------------------------- */
  
  /**
   * The id of the associated wall.
   */
  get id() {
    if(!this._id ) { this._id = foundry.utils.randomID(); }
    return this._id;  
  }
  
  /*
   * @param {[number, number, number, number]}
   */
  get coords() { return [this.A.x, this.A.y, this.B.x, this.B.y]; }
  
  /*
   * @param {number}
   */
  get radius() { return this._radius; }
  
  /*
   * @param {x: number, y: number}
   */
  get origin() { return this._origin; }
  
  /* 
   * Is this point associated with a radius? Radius 0 does not count.
   * @return {boolean}
   */
  get hasRadius() {
    return Boolean(this._radius);
  }
  
  /*
   * Is this point inside the FOV radius?
   * @return {undefined|boolean}
   */
  get radiusIntersections() {
    if(!this.hasRadius || !this.origin) return undefined;
    if(this._radiusIntersections === undefined) {
      this._radiusIntersections = intersectionsWithCircle(this.origin. this.radius);
    }
    return this._radiusIntersections;
  }
  
  /*
   * When setting origin, un-cache measurements that depend on it.
   * @param {x: number, y: number} value
   */
  set origin(value) {
    this._origin = value;
    this._radiusIntersections = undefined;
  }
  
  /*
   * When setting radius, un-cache measurements that depend on it.
   * @param {number} value
   */
  set radius(value) {
    this._radius = value;
    this._radiusIntersections = undefined;
  }
  
  /* -------------------------------------------- */
  /*  Factory Function                            */
  /* -------------------------------------------- */
  
  /*
   * Take a wall and convert it to a CCWSweepWall
   * @param {Wall}  wall
   * @return {CCWSweepWall}
   */
  static createCCWSweepWall(wall) {
    const [x0, y0, x1, y1] = wall.coords;
    const w = new CCWSweepWall({ x: x0, y: y0 },
                               { x: x1, y: y1 });
    w.isOpen = wall.isOpen;
    w.data = duplicate(wall.data);
    w.isInterior = (wall.roof?.occluded === false);
    w._id = wall.data._id;
    
    return w;
  }
  
  /* -------------------------------------------- */
  /*  Getters/Setters                             */
  /* -------------------------------------------- */
  

  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
  /*
   * Check if point is counter-clockwise or clockwise to a wall
   * Wall left/right direction measured in Foundry from wall.B --> wall.A
   * Thus CW/CCW here measured accordingly
   * wall.B --> wall.A --> origin
   * See whichSide method.
   * 
   * @param {x: number, y: number} p 
   * @return {number} Positive if CCW, Negative if CW, 0 if in line
   */ 
  orient2d(p) { 
    return orient2dPoints(this.B, this.A, p);
  }


  /*
   * Report the side of the origin in relation to the wall, using ccw algorithm.
   * Return in terms of CONST.WALL_DIRECTIONS
   *
   * Wall left/right direction measured in Foundry from wall.B --> wall.A
   * 
   * @param {x: number, y: number} p  
   * @return {0|1|2} RIGHT if wall.B --> wall.A --> origin is a CCW (left) turn
   *                 LEFT if wall.B --> wall.A --> origin is a CW (right) turn
   *                 BOTH if all three points are in line.
   */
  whichSide(p) {
    const orientation = this.orient2d(p);
  
    return orientation < 0 ? CONST.WALL_DIRECTIONS.LEFT : 
           orientation > 0 ? CONST.WALL_DIRECTIONS.RIGHT : 
                             CONST.WALL_DIRECTIONS.BOTH;
  }  

} 


