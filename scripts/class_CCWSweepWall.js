/* globals foundry, CONST */
'use strict';

import { CCWSightRay } from "./class_CCWSightRay.js";
import { CCWSweepPoint } from "./class_CCWSweepPoint.js";
import { orient2dPoints, COLORS } from "./util.js";

/*
 * Subclass of CCWSightRay used for storing Wall segments used in the CCW Sweep algorithm.
 * CCWSightRay extends Ray, so these are basically Ray versions of Wall segments
 * @extends{CCWSightRay}
 */
export class CCWSweepWall extends CCWSightRay {
  constructor(A, B, {origin, radius} = {}) {
    super(A, B);

    // Re-set A and B with origin and radius
    // See setter below
    this._A = new CCWSweepPoint(A.x, A.y, { origin, radius });;
    this._B = new CCWSweepPoint(B.x, B.y, { origin, radius });
    
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
    this.data = {light: 1, move: 1, sight: 1, sound: 1, dir: 0, door: 0};
    
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
    
    /*
     * Store whether the wall intersects the radius
     * Store as LEC2 value from intersectsCircle
     */
    this._intersectsRadius = undefined;
    
    
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
  set id(value ) { this._id = value; }
   
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
   * Get the intersection points of this wall with the circle radius
   * Cache the result.
   * @return {undefined|boolean}
   */
  get radiusIntersections() {
    const intersects_radius = this.intersectsRadius
    if(intersects_radius === undefined) return undefined;
    if(!intersects_radius) return [];
    
    if(this._radiusIntersections === undefined) {
      this._radiusIntersections = this.intersectionsWithCircleGeometry(this.origin, this.radius, { robust = true, LEC2 = intersects_radius });
    }
    return this._radiusIntersections;
  }
  
 /**
  * Does the wall intersect the radius circle?
  * Cache the result.
  * @type {boolean|undefined}
  */
  get intersectsRadius() {
    if(this._intersectRadius === undefined && this.origin && this.radius) {
      this._intersectRadius = this.intersectsCircle(this.origin, this.radius, { returnLEC2: true }); 
    }
    if(this._intersectRadius === undefined) return undefined;
    
    const R2 = this.radius * this.radius;
    const LEC2 = this._intersectRadius;
    return LEC2 < R2 || almostEqual(LEC2, R2);
  } 
  
  /*
   * When setting origin, un-cache measurements that depend on it.
   * @param {x: number, y: number} value
   */
  set origin(value) {
    this._origin = value;
    this.A.origin = value;
    this.B.origin = value;
    this._radiusIntersections = undefined;
    this._intersectRadius = undefined;
  }
  
  /*
   * When setting radius, un-cache measurements that depend on it.
   * @param {number} value
   */
  set radius(value) {
    this._radius = value;
    this.A.radius = value;
    this.B.radius = value;
    this._radiusIntersections = undefined;
    this._intersectRadius = undefined;
  }
  
  /**
   * Make A and B SweepPoints
   * Useful for consistency in treating endpoints and walls
   * @type {CCWSweepPoint}
   */
   get A() { return this._A; }
   set A(value) {
     this._A = new CCWSweepPoint(value.x, value.y, { origin: this.origin, radius: this.radius });
     this._radiusIntersections = undefined;
     this._intersectRadius = undefind;
   }
   
  /**
   * @type {CCWSweepPoint}
   */
   get B() { return this._B; }
   set B(value) {
     this._B = new CCWSweepPoint(value.x, value.y, { origin: this.origin, radius: this.radius });
     this._radiusIntersections = undefined;
     this._intersectRadius = undefined;
   }
  /* -------------------------------------------- */
  /*  Factory Function                            */
  /* -------------------------------------------- */
  
  /*
   * Take a wall and convert it to a CCWSweepWall
   * @param {Wall}    wall
   * @param {Object}  opts    Options passed to CCWSweepWall
   * @return {CCWSweepWall}
   */
  static create(wall, opts = {}) {
    
    if(wall instanceof CCWSweepWall) {
      // so we can pass a mix of wall & SweepWall
      // need to update options, if any
      if(opts?.origin) wall.origin = opts.origin;
      if(opts?.radius) wall.radius = opts.radius;
      return wall; 
    }
   
    const [x0, y0, x1, y1] = wall.coords;
    const w = new CCWSweepWall({ x: x0, y: y0 },
                               { x: x1, y: y1 }, opts);
    w.isOpen = wall.isOpen;
    //w.data = duplicate(wall.data);
    w.data = wall.data;
    w.isInterior = (wall.roof?.occluded === false);
    w._id = wall.data._id;
    
    return w;
  }
  
 /**
  * Somewhat specialized method to create a sweep wall with specific coordinates
  * but attach wall data to it. Used to process intersections between walls.
  * See CCWSweepPolygon.prototype._processWallIntersections 
  * @param {PIXI.Point}   A   Passed to CCWSweepWall 
  * @param {PIXI.Point}   B   Passed to CCWSweepWall
  * @param {Wall|CCWSweepWall}         wall
  * @param {Object}  opts    Options passed to CCWSweepWall
  * @return {CCWSweepWall}
  */
  static createFromPoints(A, B, wall, opts = {}) {
    const w = new CCWSweepWall(A, B, opts);
    w.isOpen = wall.isOpen;
    w.data = wall.data;
    w.isInterior = wall instanceof CCWSweepWall ? w.isInterior : (wall.roof?.occluded === false);
    return w;
  }
  
  
  
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
  
 /**
  * Draw the wall (for debugging)
  * @param {number} color
  * @param {number} alpha
  * @param {number} width
  */
  draw(color = COLORS.red, alpha = 1, width = 1) {
    CCWSightRay.prototype.draw.call(this, color, width, alpha);
  }

} 


