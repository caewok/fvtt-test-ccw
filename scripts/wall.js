'use strict';

// Additions to the wall class
import { almostEqual, orient2dPoints } from "./util.js";
import { log } from "./module.js";

/*
 * Wall.prototype.ccw
 *
 * Check if origin is counter-clockwise or clockwise to a wall
 * Wall left/right direction measured in Foundry from wall.B --> wall.A
 * Thus ccw here measured accordingly
 * wall.B --> wall.A --> origin
 * See whichSide method.
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {Number} Positive if CCW, Negative if CW, 0 if in line
 */ 
export function wallCCW(origin) {
  const c = this.coords;  
  return orient2dPoints(this.B, this.A, origin);
}


/*
 * Wall.prototype.whichSide
 *
 * Report the side of the origin in relation to the wall, using ccw algorithm.
 * Return in terms of CONST.WALL_DIRECTIONS
 *
 * Wall left/right direction measured in Foundry from wall.B --> wall.A
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {0|1|2} LEFT if wall.B --> wall.A --> origin is a CCW (left) turn
 *                 RIGHT if wall.B --> wall.A --> origin is a CW (right) turn
 *                 BOTH if all three points are in line.
 */
export function wallWhichSide(origin) {
  const orientation = this.ccw(origin);
  
  return orientation > 0 ? CONST.WALL_DIRECTIONS.LEFT : 
         orientation < 0 ? CONST.WALL_DIRECTIONS.RIGHT : CONST.WALL_DIRECTIONS.BOTH;
}



/*
 * Wall.prototype.A
 * 
 * Get first endpoint coordinates for wall.
 * Used for compatibility with Ray methods.
 * @return {x, y}
 */
export function wallA() {
  return { x: this.coords[0], y: this.coords[1] };
}

/*
 * Wall.prototype.B
 * 
 * Get second endpoint coordinates for wall
 * Used for compatibility with Ray methods.
 * @return {x, y}
 */
export function wallB() {
  return { x: this.coords[2], y: this.coords[3] };
}

