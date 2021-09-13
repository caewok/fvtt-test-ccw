// Additions to the wall class
import { orient2d } from "./lib/orient2d.min.js";
import { almostEqual } from "./util.js";
import { log } from "./module.js";

/*
 * Wall.prototype.ccw
 *
 * Check if the wall is counter-clockwise or clockwise in relation to an origin point.
 * origin --> northern/western wall coord --> southern/eastern wall coord
 * See whichSide method.
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {Number} Negative if counter-clockwise, Positive if clockwise, 0 if origin is in line with the wall
 */ 
export function wallCCW(origin) {
  const c = this.coords;
  
  // always go from origin --> northern wall coord --> southern wall coord
  let p_northern = { x: c[0], y: c[1] }
  let p_southern = { x: c[2], y: c[3]} 
  let flip = false;
  
  
  if(almostEqual(c[1], c[3]) && (c[2] > c[0])) {
    // wall segment is horizontal and point 0 is east of point 1. 
    // By convention, counter-clockwise for northern
    // flip points so origin --> western wall coord --> eastern wall coord
   //log("Wall is horizontal; flipping."); 
   flip = true;
  
  } else if(c[1] > c[3]) {
   //log("Wall points reversed; flipping.");
    flip = true;
  }
  
  if(flip) {
    p_northern = { x: c[2], y: c[3] }
    p_southern = { x: c[0], y: c[1]} 
  }
  
  return orient2d(origin.x, origin.y,
                  p_northern.x, p_northern.y,
                  p_southern.x, p_southern.y);
}


/*
 * Wall.prototype.whichSide
 *
 * Report the side of the origin in relation to the wall, using ccw algorithm.
 * Return in terms of CONST.WALL_DIRECTIONS
 * 
 * @param {PIXI.point} origin   PIXI.point or other object with {x, y}.
 * @return {Number} 0 if origin is in line with the wall, 1 if left, 2 if right
 */
export function wallWhichSide(origin) {
  const orientation = this.ccw(origin);
  
  return orientation < 0 ? CONST.WALL_DIRECTIONS.LEFT : 
         orientation > 0 ? CONST.WALL_DIRECTIONS.RIGHT : CONST.WALL_DIRECTIONS.BOTH;
}

/*
 * Wall.prototype.effectSide
 *
 * Report the side of the effect for the wall. 
 * This is comparable to Wall.prototype.direction, 
 * but does not vary based on how the wall was drawn. 
 * (left is always to the left or up)
 * Return in terms of CONST.WALL_DIRECTIONS
 * @return {Number} 0 if both, 1 if left (north), 2 if right (south)
 */
export function wallEffectSide() {
  let d = this.data.dir;
  if(!d) return CONST.WALL_DIRECTIONS.BOTH;
  
  const c = this.coords;
  
  // if y0 is lower, then wall is y0 --> y1 from top to bottom
  // effect matches data.dir
  if(c[1] < c[3]) { return d }
  if(c[1] > c[3]) { return (d === 1) ? CONST.WALL_DIRECTIONS.RIGHT : CONST.WALL_DIRECTIONS.LEFT }

  // wall is horizontal
  // use the x values. if x0 --> x1, then data.dir is flipped
  if(c[0] > c[2]) { return d }
  if(c[0] < c[2]) { return (d === 1) ? CONST.WALL_DIRECTIONS.RIGHT : CONST.WALL_DIRECTIONS.LEFT }
  
  return undefined; // wall is a point
}

/*
 * Wall.prototype.A
 * 
 * Get first endpoint coordinates for wall
 * @return {x, y}
 */
export function wallA() {
  return { x: this.coords[0], y: this.coords[1] };
}

/*
 * Wall.prototype.B
 * 
 * Get second endpoint coordinates for wall
 * @return {x, y}
 */
export function wallB() {
  return { x: this.coords[2], y: this.coords[3] };
}

