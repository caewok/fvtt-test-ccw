// Additions to the wall class
import { orient2d } from "./lib/orient2d.min.js";

/*
 * Wall.prototype.ccw
 *
 * Check if the wall is counter-clockwise or clockwise in relation to an origin point.
 * origin --> first wall coord --> second wall coord
 * See whichSide method.
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {Number} Negative if counter-clockwise, Positive if clockwise, 0 if origin is in line with the wall
 */ 
export function wallCCW(origin) {
  const c = this.coords;
  return orient2d(origin.x, origin.y,
           c[0], c[1],
           c[2], c[3]);
}


/*
 * Wall.prototype.whichSide
 *
 * Report the side of the origin in relation to the wall, using ccw algorithm.
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {Number} -1 if left, 1 if right, 0 if origin is in line with the wall
 */
export function wallWhichSide(origin) {
  const orientation = this.ccw(origin);
  
  return orientation < 0 ? -1 : 
         orientation > 0 ?  1 : 0;
}
