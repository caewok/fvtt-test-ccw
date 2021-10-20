'use strict';
/* globals PIXI, canvas, game */

import { almostEqual, PRESET_EPSILON, COLORS } from "./util.js";
import { orient2d, orient2dfast } from "./lib/orient2d.min.js";
import { incircle, incirclefast } from "./lib/incircle.min.js";
import { MODULE_ID } from "./module.js"


/** 
 * Point class with methods used to compare between points.
 * A point is represented by real x, y numbers
 * @extends {PIXI.Point}
 * @property {number} x     The x-coordinate
 * @property {number} y     The y-coordinate
 */
export class CCWPoint extends PIXI.Point {
 
  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */
   
 /**
  * Compare whether two points are nearly equal
  * @param {PIXI.Point} p1
  * @param {PIXI.Point} p2
  * @param {number}    EPSILON   Error tolerance for almostEqual test.
  * @return {Boolean} True if points are within the error of each other.
  */
  static almostEqual(p1, p2, { EPSILON = PRESET_EPSILON } = {}) {
    return almostEqual(p1.x, p2.x, { EPSILON }) && almostEqual(p1.y, p2.y, { EPSILON });
  }
  
 /**
  * Is point 3 clockwise or counterclockwise (CCW) of the line from p1 -> p2 -> p3
  * @param {x, y} p1   Point in {x, y} format.
  * @param {x, y} p2   Point in {x, y} format.
  * @param {x, y} p3   Point in {x, y} format.
  * @param {number}    EPSILON   Error tolerance for almostEqual test.
  * @return {Number}  Positive if CCW, Negative if CW, 0 if in line
  */
  static orient2d(p1, p2, p3) {
  if(!game.modules.get(MODULE_ID).api.use_robust_ccw) {
    return orient2dfast(p1.x, p1.y,
                        p2.x, p2.y,
                        p3.x, p3.y)
  }

  return orient2d(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y);
  } 
  
 /**
  * Same as orient2d but checks for 0 and returns -1, 0, or 1
  * @param {x, y} p1   Point in {x, y} format.
  * @param {x, y} p2   Point in {x, y} format.
  * @param {x, y} p3   Point in {x, y} format.
  * @param {number}    EPSILON   Error tolerance for almostEqual test.
  * @return {-1|0|1}   1 if CCW, -1 if CW, 0 if in line
  */
  static ccw(p1, p2, p3, { EPSILON = PRESET_EPSILON } = {}) {
    const res = CCWPoint.orient2d(p1, p2, p3);
    if(almostEqual(res, 0, { EPSILON })) return 0;
    return res < 0 ? -1 : 1;                       
  } 
  
 /**
  * Given three counter-clockwise points that define a circle, is this fourth point
  * within the circle?
  * @param {x, y} p1   Point in {x, y} format.
  * @param {x, y} p2   Point in {x, y} format.
  * @param {x, y} p3   Point in {x, y} format.
  * @param {x, y} p4   Point in {x, y} format.
  * @return {Number}   Positive if outside circle, Negative if inside, 0 if on circle
  */
  static inCircle(p1, p2, p3, p4) {
    if(!p1 || !p2 || !p3 || !p4) console.warn(`${MODULE_ID}|point undefined`, p1, p2, p3, p4);

     if(!game.modules.get(MODULE_ID).api.use_robust_ccw) {
      return incirclefast(p1.x, p1.y,
                          p2.x, p2.y,
                          p3.x, p3.y,
                          p4.x, p4.y);
    }

    return incircle(p1.x, p1.y,
                    p2.x, p2.y,
                    p3.x, p3.y,
                    p4.x, p4.y);
  } 
  
 /**
  * Comparable to ccw for inCirclePoints.
  * @param {x, y} p1   Point in {x, y} format.
  * @param {x, y} p2   Point in {x, y} format.
  * @param {x, y} p3   Point in {x, y} format.
  * @param {x, y} p4   Point in {x, y} format.
  * @return {1|0|-1}   1 if outside circle, -1 if inside, 0 if on circle
  */
  static outsideCircle(p1, p2, p3, p4, { EPSILON = PRESET_EPSILON }) {
    const res = CCWPoint.inCircle(p1, p2, p3, p4);
    if(almostEqual(res, 0, { EPSILON })) return 0;
    return res < 0 ? -1 : 1;
  }
  
  
  /* -------------------------------------------- */
  /*  Factory Functions                           */
  /* -------------------------------------------- */
  
 /**
  * Construct a CCWPoint from any object that contains x and y.
  * @param {x: number, y: number} p
  * @return CCWPoint
  */ 
  static fromPoint(p) {
    return new this(p.x, p.y);
  }
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

 /**
  * Test if this point is almost equal to some other {x, y} point.
  * @param {PIXI.Point} p       Point to compare
  * @param {number}     EPSILON Tolerate distance between. Passed to almostEqual.
  * @return {boolean}
  */
  almostEqual(p, { EPSILON = PRESET_EPSILON } = {}) {
    return pointsAlmostEqual(this, p, { EPSILON });
  }
  
 /**
  * Calculate the distance between this and another point
  * @param {PIXI.Point} p  
  * @param {Number}  EPSILON   Error within which the distance will be considered 0
  * @return The distance between the two points. 
  */
  distance(p, { EPSILON = PRESET_EPSILON } = {}) {
    // could use pointsAlmostEqual function but this avoids double-calculating
    const dx = Math.abs(p.x - this.x); 
    const dy = Math.abs(p.y - this.y);
    if(dy < EPSILON && dx < EPSILON) { return 0; }
    if(dy < EPSILON) { return dx; }
    if(dx < EPSILON) { return dy; }

    return Math.hypot(dy, dx);
  }
  
 /**
  * Distance squared to another point.
  * @param {PIXI.Point} p   Point to measure
  * @return {number}
  */
  distanceSquared(p) {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return (dx*dx + dy*dy);
  }

 /**
  * Draw the point (for debugging)
  * @param {number} color
  * @param {number} alpha
  * @param {number} radius
  */
  draw(color = COLORS.red, alpha = 1, radius = 5) {
    canvas.controls.debug
      .beginFill(color, alpha)
      .drawCircle(this.x, this.y, radius)
      .endFill();
  }
  

}