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
     * @type {PIXI.Point}
     */
    this.origin = origin;
    
    /**
     * Radius of the FOV.
     * Only required if insideRadius is used.
     * Should be strictly positive.
     * @type {number}
     */
    this.radius = radius;
    
    /**
     * Cache whether this point is inside the FOV radius.
     * @type {boolean}
     * @private
     */
    this._insideRadius = undefined;
  }
  
  /* -------------------------------------------- */
  /*  Getters / Setters                           */
  /* -------------------------------------------- */
  
  /* 
   * Is this point associated with a radius?
   * @return {boolean}
   */
  get hasRadius() {
    return this.radius !=== undefined;
  }
  
  /*
   * Is this point inside the FOV radius?
   * @return {undefined|boolean}
   */
  get insideRadius() {
    if(!this.hasRadius) return undefined;
    if(this._insideRadius === undefined) {
      const dx = this.x - this.origin.x;
      const dy = this.y - this.origin.y;
    
      this._insideRadius = (dx*dx + dy*dy) <= this.radius;
    }
    return this._insideRadius;
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
  /**
   * Does this endpoint equal some other endpoint?
   * This version treats points equivalent if rounded values are equal
   * @param {Point} other     Some other point with x and y coordinates
   * @returns {boolean}       Are the points equal?
   */
  equals(other) {
    return (Math.round(other.x) === Math.round(this.x)) && 
           (Math.round(other.y) === Math.round(this.y));
  }
}