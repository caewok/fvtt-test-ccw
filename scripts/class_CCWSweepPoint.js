'use strict';

import { pointsAlmostEqual } from "./util.js";

/* 
 * Subclass that operates comparably to WallEndpoint but does not round x, y.
 * Still keys x,y to a rounded integer point, and treats two such points as equal.
 * Non-rounded version needed to mark points on a line where integer points would not
 * be sufficiently exact.
 * @extends {PIXI.Point}
 * @property {number} x     The integer x-coordinate
 * @property {number} y     The integer y-coordinate
 */
export class CCWSweepPoint extends PIXI.Point {
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
   * Is this point associated with a radius? Radius 0 does not count.
   * @return {boolean}
   */
  get hasRadius() {
    return Boolean(this._radius);
  }
  
  /*
   * Distance squared to origin. Used for comparisons.
   */
  get distanceSquaredToOrigin() {
    if(this._distanceSquaredToOrigin === undefined) {
      this._distanceSquaredToOrigin = this.distanceSquared(this.origin);
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
  
  /*
   * Test if the key for this point equals another, suggesting they are equal points
   * (at least, equal as rounded to the nearest integer)
   * @param {CCWSweepPoint|WallEndpoint} p  Other point to test against
   */  
  keyEquals(p) {
    return this.key === p.key;
  } 
  
  /*
   * Test if this point is almost equal to some other {x, y} point
   * @param {x: number, y: number} p    Point to compare
   */
  almostEqual(p) {
    return pointsAlmostEqual(this, p)
  }
  
  
  /*
   * Import the WallEndpoint get key method
   */
  static getKey = WallEndpoint.getKey;
}
