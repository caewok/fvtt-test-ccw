'use strict';


/* 
 * Subclass that operates comparably to WallEndpoint but does not round x, y.
 * Still keys x,y to a rounded integer point, and treats two such points as equal.
 * Non-rounded version needed to mark points on a line where integer points would not
 * be sufficiently exact.
 * @extends {PIXI.Point}
 * @property {number} x     The integer x-coordinate
 * @property {number} y     The integer y-coordinate
 */
class CCWSweepPoint extends PIXI.Point {
  constructor(x, y, {origin, radius} = {}) {
    super(x, y)

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /**
     * Express the point as a 32-bit integer with 16 bits allocated to x 
     * and 16 bits allocated to y. Same as WallPoint version.
     * @type {number}
     */
    this.key = WallEndpoint.getKey(this.x, this.y);
    
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
  /*  Getters / Setters                           */
  /* -------------------------------------------- */
  
  /*
   * @param {number}
   */
  get radius() { return this._radius; }
  
  /*
   * @param {x: number, y: number}
   */
  get origin() { return this._origin; }
  
  /* 
   * Is this point associated with a radius?
   * @return {boolean}
   */
  get hasRadius() {
    return this.radius !=== undefined;
  }
  
  /*
   * Distance squared to origin. Used for comparisons.
   */
  get distanceSquaredToOrigin() {
    if(this._distanceSquaredToOrigin = undefined) {
      this._distanceSquaredToOrigin = distanceSquared(this.origin);
    }
    return this._distanceSquaredToOrigin;
  }
    
  /*
   * Is this point inside the FOV radius?
   * @return {undefined|boolean}
   */
  get insideRadius() {
    if(!this.hasRadius) return undefined;
    if(this._insideRadius === undefined) { 
      this._insideRadius = this.distanceSquaredToOrigin <= (this.radius * this.radius);
    }
    return this._insideRadius;
  }
  
  /*
   * When setting origin, un-cache measurements that depend on it.
   * @param {x: number, y: number} value
   */
  set origin(value) {
    this._origin = value;
    this._distanceSquaredToOrigin = undefined;
    this._insideRadius = undefined;
  }
  
  /*
   * When setting radius, un-cache measurements that depend on it.
   * @param {number} value
   */
  set radius(value) {
    this._radius = value;
    this._insideRadius = undefined;
  }
   

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
  /*
   * Distance squared used for comparisons.
   * @param {x: number, y: number}  p   Point to measure to
   */
  distanceSquared(p) {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return (dx*dx + dy*dy);
  }
  
  /**
   * Does this endpoint equal some other endpoint?
   * This version treats points equivalent if rounded values are equal
   * @param {x: number, y: number} other     Some other point with x and y coordinates
   * @returns {boolean}       Are the points equal?
   */
  equals(other) {
    return (Math.round(other.x) === Math.round(this.x)) && 
           (Math.round(other.y) === Math.round(this.y));
  }
}