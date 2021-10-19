'use strict';
/* globals PIXI, canvas */

import { pointsAlmostEqual, PRESET_EPSILON, COLORS } from "./util.js";

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
  * @param {number}    EPSILON   Error tolerance for almostEqual test.
  * @param {PIXI.Point} p0
  * @param {PIXI.Point} p1
  */
  static pointsAlmostEqual(p0, p1, { EPSILON = PRESET_EPSILON } = {}) {
    if(p0 instanceof CCWPoint) return p0.almostEqual(p1, { EPSILON });
    if(p1 instanceof CCWPoint) return p1.almostEqual(p0, { EPSILON });
    return pointsAlmostEqual(p0, p1, { EPSILON });
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