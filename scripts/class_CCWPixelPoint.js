'use strict';
/* globals PIXI, WallEndpoint */

import { CCWPoint } from "./class_CCWPoint.js";
import { almostEqual, PRESET_EPSILON } from "./util.js";

/**
 * Represent point as a single pixel, meaning it has integer x,y coordinates.
 * Assume a square grid of points at the integer coordinates of the grid.
 * Any coordinate within 1/2 of the diagonal between two integer points is considered
 * part of that point. 
 * Per Pythagorean's theorem, the diagonal is a^2 + b^2 = c^2 -> √2
 * Thus, if a random CCWPoint is within ± √2 / 2 of a PixelPoint, that CCWPoint can be
 * considered part of or equivalent to the PixelPoint.
 * 
 * For the constructor, the coordinates could belong to up to 4 PixelPoints.
 * They are coerced to the closest point by simply rounding to the nearest integer.
 * @extends {CCWPoint}
 * @property {number} x     The x-coordinate. 
 * @property {number} y     The y-coordinate
 */
export class CCWPixelPoint extends CCWPoint {
  constructor(x, y) {
    super(x, y);
    
    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */
    
   /**
    * Integer coordinate
    * @type {number}
    */
    this.x = Math.round(x);
    
   /**
    * Integer coordinate
    * @type {number}
    */
    this.y = Math.round(y);
    
   /**
    * Express the point as a 32-bit integer with 16 bits allocated to x 
    * and 16 bits allocated to y. Same as WallPoint version.
    * @type {number}
    */
    this.key = CCWPixelPoint.getKey(this.x, this.y);
  }
     
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
 /**
  * Is this point exactly equal to another?
  * Fine for two PixelPoints, but otherwise you probably want almostEquals. 
  * @param {PIXI.Point} p
  * @return {boolean}
  */
  equals(p) {
    if(p instanceof CCWPixelPoint) return this.key === p.key;
    return PIXI.Point.prototype.equals.call(this, p);
  }
  
 /**
  * Is this point almost equal to another?
  * The point must be within ± √2 / 2 of this point.
  * @param {PIXI.Point} p
  * @param {number}     EPSILON Passed to almostEqual.
  * @return {boolean}
  */
  almostEqual(p, { EPSILON = PRESET_EPSILON } = {}) {
    if(p instanceof CCWPixelPoint) return this.key === p.key;
    
    // Ultimately need the distance between the two points but first check the easy case
    // if points exactly vertical or horizontal, the x/y would need to be within √2 / 2
    if(!pointsAlmostEqual(this, p, { EPSILON: Math.SQRT1_2 })) { return false; }
    
    // within the √2 / 2 bounding box
    // compare distance squared.
    // equality with the distance measurement
    const dist2 = this.distanceSquared(p);
    if(almostEqual(dist2, 0.5, { EPSILON })) return true;
    return dist2 < 0.5; // √2 / 2 * √2 / 2 = 0.5    
  }
}

/**
 * Import WallEndpoint.getKey as static method.
 */
Object.defineProperty(CCWPixelPoint, "getKey", {
  value: WallEndpoint.getKey,
  writable: true,
  configurable: false
});