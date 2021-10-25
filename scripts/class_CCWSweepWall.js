/* globals foundry, CONST */
'use strict';

import { CCWPixelRay } from "./class_CCWPixelRay.js";
import { CCWSweepPoint } from "./class_CCWSweepPoint.js";

/*
 * Subclass of CCWPixelRay used for storing Wall segments used in the CCW Sweep algorithm.
 * CCWPixelRay extends Ray, so these are basically Ray versions of Wall segments.
 * This subclass stores various wall information used by the sweep algorithm.
 * @extends{CCWSightRay}
 */
export class CCWSweepWall extends CCWPixelRay {
  constructor(A, B, { origin, type, update_endpoints = true } = {}) {
    super(A, B, { update_endpoints: false });

    if(update_endpoints) {
      this.A = new CCWSweepPoint(A.x, y: A.y);
      this.A = new CCWSweepPoint(B.x, B.y);
    } 
        
    this.A.walls.set(this.id, this);
    this.B.walls.set(this.id, this);
    
    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    // set reasonable defaults for some properties 

    /**
     * Is this wall door open? False if not a door or closed.
     * @type {boolean} 
     */
    this.isOpen = false;
   
    /*
     * Wall data
     * @type {object}   
     */
    this.data = { light: 1, move: 1, sight: 1, sound: 1, dir: 0, door: 0, _id: this.id };
    
    /*
     * Does the wall have a reference to a roof that is occluded?
     */
    this.isInterior = false;
    
    /**
     * Origin for the sweep.
     * Only required if insideRadius is used.
     * @type {PIXI.Point}
     * @private
     */
    this._origin = origin;
    
   /**
    * Store the ccw result for this line to the origin.
    * Used repeatedly in sorting the sweep
    * @type {-1|0|1}
    * @private
    */
    this._ccwOrigin = undefined; 
    
   /**
    * Type of wall
    * @type {string}
    */ 
    this.type = type;
    
   /**
    * Cache the left and right endpoints in relation to origin.
    * @type {CCWSweepPoint}
    */
    this._endpointOrientation = undefined;
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
  
  /**
   * @type {string}
   */ 
  set id(value ) { 
    this.A.walls.delete(this.id);
    this.B.walls.delete(this.id);
    
    this._id = value; 
    
    this.A.walls.set(this.id, this);
    this.B.walls.set(this.id, this);
  }
   
  /*
   * @param {x: number, y: number}
   */
  get origin() { return this._origin; }
    

  /**
   * When setting origin, un-cache measurements that depend on it.
   * @param {x: number, y: number} value
   */
  set origin(value) {
    this._origin = value;
    this._ccwOrigin = undefined;
    this._distanceSquaredOrigin = undefined;
    this._endpointOrientation = undefined;
  }
  
 /**
  * Cache the ccw measurement for this line to the origin.
  */
  get ccwOrigin() { 
    if(this._ccwOrigin === undefined) { this._ccwOrigin = this.ccw(this.origin); }
    return this._ccwOrigin;
  }
  
 /**
  * Cache the distance squared to the origin.
  * Every use case seems to check both A and B, so just cache together.
  */
  get distanceSquaredOrigin() {
    if(this._distanceSquaredOrigin === undefined) {
      this._distanceSquaredOrigin = { A: this.A.distanceSquared(this.origin),
                                      B: this.B.distanceSquared(this.origin) }
    }
    return this._distanceSquaredOrigin;
  }
  
  

 /**
  * Report the side of the origin in relation to the wall, using ccw algorithm.
  * Return in terms of CONST.WALL_DIRECTIONS
  *
  * Wall left/right direction measured in Foundry from wall.B --> wall.A
  * 
  * @return {0|1|2} RIGHT if wall.B --> wall.A --> origin is a CCW (left) turn
  *                 LEFT if wall.B --> wall.A --> origin is a CW (right) turn
  *                 BOTH if all three points are in line.
  */
  get whichSide() {
    const orientation = this.ccwOrigin;
  
    return orientation < 0 ? CONST.WALL_DIRECTIONS.LEFT : 
           orientation > 0 ? CONST.WALL_DIRECTIONS.RIGHT : 
                             CONST.WALL_DIRECTIONS.BOTH;
  }  
  
 /**
  * Get the point counterclockwise (left/start) in relation to the origin.
  * If in line with the origin, the closer point is the left/start point
  * Will be the starting point for the sweep.
  * Named 'left' and 'right' to avoid confusion with ccw/cw. or start/end endpoint.
  */
  get leftEndpoint() {
    if(this._endpointOrientation === undefined) {
      if(this.ccwOrigin === 0) {
        this._endpointOrientation = 
          this._distanceSquaredOrigin.A > this._distanceSquaredOrigin.B ?
          { left: this.B, right: this.A } : { left: this.A, right: this.B };
        
      } else {
        this._endpointOrientation = this.ccwOrigin === 1 ? 
          { left: this.B, right: this.A } : { left: this.A, right: this.B };
      }
    }
    return this._endpointOrientation.left;
  }
  
  get rightEndpoint() {
    if(this._endpointOrientation === undefined) {
      // just run the left endpoint again to set both.
      this.leftEndpoint;
    }
    return this._endpointOrientation.right;
  }
  
   
   
  /* -------------------------------------------- */
  /*  Factory Function                            */
  /* -------------------------------------------- */
  
  /*
   * Take a wall and convert it to a CCWSweepWall
   * @param {Wall}    wall
   * @param {Object}  opts          Options passed to CCWSweepWall or other creator
   * @param {boolean}  keep_wall_id  Take id from wall provided
   *   Generally don't want to keep the id as it will lead to repeated ids,
   *   and the sweep algorithm required unique ids
   * @return {CCWSweepWall}
   */
  static create(wall, opts, { keep_wall_id = false } = {}) {
    if(wall instanceof CCWSweepWall) {
      // so we can pass a mix of wall & SweepWall
      // need to update options, if any
      if(opts?.origin) wall.origin = opts.origin;      
      if(!keep_wall_id) wall._id = undefined;
      
      return wall; 
    }
   
    const [x0, y0, x1, y1] = wall.coords;
    const w = new this({ x: x0, y: y0 }, { x: x1, y: y1 }, opts);
    w.isOpen = wall.isOpen;
    //w.data = duplicate(wall.data);
    w.data = wall.data;
    w.isInterior = (wall.roof?.occluded === false);
    if(keep_wall_id) { w._id = wall.data._id; }
    
     if(!w.data._id) { w.data._id = w.id; }  
    
    return w;
  }
  
 /**
  * Somewhat specialized method to create a sweep wall with specific coordinates
  * but attach wall data to it. Used to process intersections between walls.
  * See CCWSweepPolygon.prototype._processWallIntersections 
  * @param {PIXI.Point}   A   Passed to CCWSweepWall 
  * @param {PIXI.Point}   B   Passed to CCWSweepWall
  * @param {Wall|CCWSweepWall}         wall
  * @param {boolean}  keep_wall_id  Take id from wall provided
  * @param {Object}  opts    Options passed to CCWSweepWall
  *   Generally don't want to keep the id as it will lead to repeated ids,
   *   and the sweep algorithm required unique ids
  * @return {CCWSweepWall}
  */
  static createFromPoints(A, B, wall, opts, { keep_wall_id = false } = {}) {
    const w = new this(A, B, opts);
    w.isOpen = wall.isOpen;
    w.data = wall.data;
    w.isInterior = wall instanceof CCWSweepWall ? w.isInterior : (wall.roof?.occluded === false);
    w._id = keep_wall_id ? wall.data._id : undefined;
    
    if(!w.data._id) { w.data._id = w.id; }  
    
    return w;
  }
  
  
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
   
 /**
  * Determine whether this wall should count for purposes of vision, 
  * given the present origin and type.
  * Comparable to RadialSweepPolygon version.
  * Test whether a Wall object should be included as a candidate for 
  *   collision from the polygon origin
  * If type or origin not defined, will default to true for those tests.
  * @type {boolean}
  */ 
  include() { 
    const type = this.type;
    if(!type) return true;
  
    // Special case - coerce interior walls to block light and sight
    if(type === "sight" && this.isInterior) return true;

    // Ignore non-blocking walls and open doors
    if(!this.data[type] || this.isOpen) return false;

    // Ignore walls on line with origin unless this is movement
    const origin = this.origin;
    if(!origin) return true;
    
    const origin_side = this.whichSide;
    if(type !== "move" && origin_side === CONST.WALL_DIRECTIONS.BOTH) return false;

    if(!this.data.dir) return true; // wall not one-directional

    // Ignore one-directional walls which are facing away from the origin    
    return origin_side === this.data.dir;
  }
  
  

} 


